using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace BetterGravityInstaller;

public enum BootstrapperState
{
    Idle,
    Checking,
    UpToDate,
    DownloadedLatest,
    OfflineFallback
}

public class RemoteManifest
{
    public string? Version { get; set; }
    public string? GeneratedAt { get; set; }
    public JsonElement Files { get; set; }
}

public static class BootstrapperService
{
    public const string EmbeddedVersion = "1.0.0";
    private const string ManifestUrl = "https://raw.githubusercontent.com/RedPanda-Craft/SuperGravity/main/apps/installer-windows/Patcher/manifest.json";
    private const string RawBaseUrl = "https://raw.githubusercontent.com/RedPanda-Craft/SuperGravity/main/";

    private static readonly HttpClient HttpClient = new()
    {
        Timeout = TimeSpan.FromSeconds(15)
    };

    private static readonly string CacheDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "BetterGravity",
        "PatcherCache"
    );

    private static readonly string RuntimeCacheDirectory = Path.Combine(CacheDirectory, "runtime");

    public static BootstrapperState State { get; private set; } = BootstrapperState.Idle;
    public static string? ActiveVersion { get; private set; } = EmbeddedVersion;
    public static string StatusMessage { get; private set; } = "Initializing...";

    public static event Action<BootstrapperState, string>? StateChanged;

    private static Task<bool>? _syncTask;
    private static readonly object SyncLock = new();

    static BootstrapperService()
    {
        HttpClient.DefaultRequestHeaders.UserAgent.Clear();
        HttpClient.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("BetterGravity-Bootstrapper", EmbeddedVersion));
        HttpClient.DefaultRequestHeaders.CacheControl = new CacheControlHeaderValue { NoCache = true };
    }

    public static Task<bool> StartSyncAsync()
    {
        lock (SyncLock)
        {
            if (_syncTask != null) return _syncTask;
            _syncTask = Task.Run(CheckAndSyncAsync);
            return _syncTask;
        }
    }

    public static async Task EnsureSyncedAsync()
    {
        var task = StartSyncAsync();
        try
        {
            await Task.WhenAny(task, Task.Delay(15000));
        }
        catch
        {
            // Fall back cleanly if sync times out or fails
        }
    }

    public static string? GetActivePatcherScriptPath()
    {
        try
        {
            var cachedPatcher = Path.Combine(CacheDirectory, "patcher-cli.cjs");
            if (File.Exists(cachedPatcher) && new FileInfo(cachedPatcher).Length > 10_000)
            {
                return cachedPatcher;
            }
        }
        catch
        {
            // Fall back to embedded
        }
        return null;
    }

    public static string? GetActiveRuntimeDirectory()
    {
        try
        {
            if (Directory.Exists(RuntimeCacheDirectory))
            {
                var mainFile = Path.Combine(RuntimeCacheDirectory, "main.cjs");
                var preloadFile = Path.Combine(RuntimeCacheDirectory, "preload.cjs");
                if (File.Exists(mainFile) && File.Exists(preloadFile) &&
                    new FileInfo(mainFile).Length > 10_000 && new FileInfo(preloadFile).Length > 5_000)
                {
                    return RuntimeCacheDirectory;
                }
            }
        }
        catch
        {
            // Fall back to embedded
        }
        return null;
    }

    private static void UpdateState(BootstrapperState newState, string message)
    {
        State = newState;
        StatusMessage = message;
        StateChanged?.Invoke(newState, message);
    }

    private static string ComputeSha256(byte[] data)
    {
        var hash = SHA256.HashData(data);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string ComputeFileSha256(string filePath)
    {
        if (!File.Exists(filePath)) return string.Empty;
        var bytes = File.ReadAllBytes(filePath);
        return ComputeSha256(bytes);
    }

    private static async Task<bool> CheckAndSyncAsync()
    {
        UpdateState(BootstrapperState.Checking, "Checking GitHub for latest patches…");

        try
        {
            Directory.CreateDirectory(RuntimeCacheDirectory);

            var manifestUrl = $"{ManifestUrl}?t={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var manifestJson = await HttpClient.GetStringAsync(manifestUrl);
            if (string.IsNullOrWhiteSpace(manifestJson))
            {
                UpdateState(BootstrapperState.OfflineFallback, "Using offline patcher bundle");
                return false;
            }

            var manifest = JsonSerializer.Deserialize<RemoteManifest>(manifestJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (manifest == null || string.IsNullOrWhiteSpace(manifest.Version))
            {
                UpdateState(BootstrapperState.OfflineFallback, "Using offline patcher bundle");
                return false;
            }

            ActiveVersion = manifest.Version;
            bool anyDownloaded = false;

            if (manifest.Files.ValueKind == JsonValueKind.Object)
            {
                foreach (var prop in manifest.Files.EnumerateObject())
                {
                    var fileKey = prop.Name;
                    var fileObj = prop.Value;

                    if (!fileObj.TryGetProperty("path", out var pathProp) ||
                        !fileObj.TryGetProperty("sha256", out var shaProp))
                    {
                        continue;
                    }

                    var relativeRepoPath = pathProp.GetString();
                    var expectedSha = shaProp.GetString()?.ToLowerInvariant();
                    if (string.IsNullOrEmpty(relativeRepoPath) || string.IsNullOrEmpty(expectedSha)) continue;

                    string localTargetPath = fileKey.StartsWith("runtime/")
                        ? Path.Combine(RuntimeCacheDirectory, Path.GetFileName(fileKey))
                        : Path.Combine(CacheDirectory, Path.GetFileName(fileKey));

                    string existingSha = ComputeFileSha256(localTargetPath);
                    if (existingSha.Equals(expectedSha, StringComparison.OrdinalIgnoreCase))
                    {
                        continue; // Already up to date
                    }

                    // Download fresh file from GitHub with cache-busting
                    var fileUrl = $"{RawBaseUrl}{relativeRepoPath.TrimStart('/')}?t={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
                    var fileBytes = await HttpClient.GetByteArrayAsync(fileUrl);
                    var downloadedSha = ComputeSha256(fileBytes);

                    if (!downloadedSha.Equals(expectedSha, StringComparison.OrdinalIgnoreCase))
                    {
                        // Checksum mismatch, do not accept
                        continue;
                    }

                    var tempFile = localTargetPath + ".tmp";
                    await File.WriteAllBytesAsync(tempFile, fileBytes);
                    File.Move(tempFile, localTargetPath, overwrite: true);
                    anyDownloaded = true;
                }
            }

            // Save the verified manifest locally
            var localManifestPath = Path.Combine(CacheDirectory, "manifest.json");
            await File.WriteAllTextAsync(localManifestPath, manifestJson);

            if (anyDownloaded)
            {
                UpdateState(BootstrapperState.DownloadedLatest, $"Synced latest v{ActiveVersion} from GitHub");
            }
            else
            {
                UpdateState(BootstrapperState.UpToDate, $"Patcher is up to date (v{ActiveVersion})");
            }

            return true;
        }
        catch
        {
            // If offline, timeout, or DNS failure: fallback cleanly
            UpdateState(BootstrapperState.OfflineFallback, "Offline mode • Using embedded bundle");
            return false;
        }
    }
}
