using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Win32;

namespace BetterGravityInstaller;

public partial class MainWindow : Window
{
    private InstallationState _state = new("not-found", "unknown", null, null, null, false, null);
    private bool _isBusy = false;

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_Loaded;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        BootstrapperService.StateChanged += OnBootstrapperStateChanged;
        _ = BootstrapperService.StartSyncAsync();
        UpdateSyncUI(BootstrapperService.State, BootstrapperService.StatusMessage);

        await InitializeInstallationAsync();
    }

    private void OnBootstrapperStateChanged(BootstrapperState state, string message)
    {
        Dispatcher.Invoke(() => UpdateSyncUI(state, message));
    }

    private void UpdateSyncUI(BootstrapperState state, string message)
    {
        VersionBadgeText.Text = $"v{BootstrapperService.ActiveVersion ?? BootstrapperService.EmbeddedVersion}";

        switch (state)
        {
            case BootstrapperState.Checking:
                SyncStatusPill.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#23242A"));
                SyncStatusDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8AB4F8"));
                SyncStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8AB4F8"));
                SyncStatusText.Text = "SYNCING";
                SyncStatusPill.ToolTip = message;
                break;

            case BootstrapperState.DownloadedLatest:
            case BootstrapperState.UpToDate:
                SyncStatusPill.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#142118"));
                SyncStatusDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#81C995"));
                SyncStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#81C995"));
                SyncStatusText.Text = "LATEST";
                SyncStatusPill.ToolTip = message;
                break;

            case BootstrapperState.OfflineFallback:
            default:
                SyncStatusPill.Background = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#23242A"));
                SyncStatusDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8E918F"));
                SyncStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8E918F"));
                SyncStatusText.Text = "OFFLINE";
                SyncStatusPill.ToolTip = message;
                break;
        }
    }

    public void CaptureAndSave(string targetPath)
    {
        try
        {
            UpdateLayout();

            int w = (int)Math.Ceiling(ActualWidth > 0 ? ActualWidth : Width);
            int h = (int)Math.Ceiling(ActualHeight > 0 ? ActualHeight : Height);

            var rtb = new System.Windows.Media.Imaging.RenderTargetBitmap(
                w,
                h,
                96,
                96,
                System.Windows.Media.PixelFormats.Pbgra32);
            rtb.Render(RootBorder);

            var encoder = new System.Windows.Media.Imaging.PngBitmapEncoder();
            encoder.Frames.Add(System.Windows.Media.Imaging.BitmapFrame.Create(rtb));

            var dir = Path.GetDirectoryName(targetPath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);

            using var stream = File.Create(targetPath);
            encoder.Save(stream);
        }
        catch (Exception ex)
        {
            File.WriteAllText(targetPath + ".err.txt", ex.ToString());
        }
    }

    private async Task InitializeInstallationAsync()
    {
        string? detected = await PatcherBridge.DetectAsync();
        if (!string.IsNullOrEmpty(detected))
        {
            _state = await PatcherBridge.InspectAsync(detected);
        }
        else
        {
            _state = new InstallationState("not-found", "unknown", null, null, null, false, null);
        }

        UpdateUI();
    }

    private void UpdateUI()
    {
        HostPathText.Text = _state.Path ?? "Scanning standard installation locations…";
        HostVersionText.Text = !string.IsNullOrEmpty(_state.AntigravityVersion)
            ? $"Version {_state.AntigravityVersion}"
            : "Antigravity not detected";

        string kind = _state.Kind;

        if (kind == "detected")
        {
            StateEyebrowText.Text = "AUTOMATIC CHECK COMPLETE";
            StateTitleText.Text = "Antigravity is ready.";
            StateDescText.Text = "A supported Antigravity installation was found. SuperGravity is not installed yet.";

            StateLabelText.Text = "UNPATCHED";
            StateDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FDD663"));
            StatePillBorder.Background = Brushes.Transparent;
            StatePillBorder.BorderBrush = Brushes.Transparent;
            StatePillBorder.ToolTip = "Unpatched";

            InstallIconText.Text = "↓";
            InstallLabelText.Text = "Install SuperGravity";
            InstallHintText.Text = "Back up original bundle, then patch Antigravity.";
            InstallActionBtn.IsEnabled = true;

            ReinstallActionBtn.IsEnabled = false;
            DeleteActionBtn.IsEnabled = false;
        }
        else if (kind == "needs-repatch")
        {
            StateEyebrowText.Text = "ACTION AVAILABLE";
            StateTitleText.Text = "Antigravity changed.";
            StateDescText.Text = "An update replaced the patched bundle. Reapply SuperGravity to get it back.";

            StateLabelText.Text = "NEEDS REPATCH";
            StateDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FDD663"));
            StatePillBorder.Background = Brushes.Transparent;
            StatePillBorder.BorderBrush = Brushes.Transparent;
            StatePillBorder.ToolTip = "Needs Repatch";

            InstallIconText.Text = "↻";
            InstallLabelText.Text = "Reapply SuperGravity";
            InstallHintText.Text = "Antigravity changed. Patch the new version.";
            InstallActionBtn.IsEnabled = true;

            ReinstallActionBtn.IsEnabled = false;
            DeleteActionBtn.IsEnabled = true;
        }
        else if (kind == "corrupted")
        {
            StateEyebrowText.Text = "NEEDS ATTENTION";
            StateTitleText.Text = "The installation is incomplete.";
            StateDescText.Text = "Part of the patch is missing. Repairing restores Antigravity from its backup.";

            StateLabelText.Text = "CORRUPTED";
            StateDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F28B82"));
            StatePillBorder.Background = Brushes.Transparent;
            StatePillBorder.BorderBrush = Brushes.Transparent;
            StatePillBorder.ToolTip = "Corrupted";

            InstallIconText.Text = "◇";
            InstallLabelText.Text = "Repair SuperGravity";
            InstallHintText.Text = "Restore original bundle and rebuild the patch.";
            InstallActionBtn.IsEnabled = true;

            ReinstallActionBtn.IsEnabled = false;
            DeleteActionBtn.IsEnabled = true;
        }
        else if (kind == "patched")
        {
            StateEyebrowText.Text = "EVERYTHING LOOKS RIGHT";
            StateTitleText.Text = "SuperGravity is installed.";
            StateDescText.Text = "Open Antigravity, then find SuperGravity in Settings to add themes and plugins.";

            StateLabelText.Text = "ACTIVE";
            StateDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#6DD58C"));
            StatePillBorder.Background = Brushes.Transparent;
            StatePillBorder.BorderBrush = Brushes.Transparent;
            StatePillBorder.ToolTip = "Active";

            InstallIconText.Text = "✓";
            InstallLabelText.Text = "SuperGravity is Active";
            InstallHintText.Text = "Antigravity is currently patched and up to date.";
            InstallActionBtn.IsEnabled = false;

            ReinstallActionBtn.IsEnabled = true;
            DeleteActionBtn.IsEnabled = true;
        }
        else if (kind == "unsupported-ide")
        {
            StateEyebrowText.Text = "ANTIGRAVITY IDE DETECTED";
            StateTitleText.Text = "Antigravity IDE is not supported yet.";
            StateDescText.Text = "SuperGravity supports the standalone Antigravity 2.0 desktop app, not the VS Code IDE. Please select your Antigravity 2.0 folder.";

            StateLabelText.Text = "IDE DETECTED";
            StateDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#F28B82"));
            StatePillBorder.Background = Brushes.Transparent;
            StatePillBorder.BorderBrush = Brushes.Transparent;
            StatePillBorder.ToolTip = "Antigravity IDE is not supported yet";

            InstallIconText.Text = "✕";
            InstallLabelText.Text = "IDE Not Supported";
            InstallHintText.Text = "Please locate the standalone Antigravity 2.0 app.";
            InstallActionBtn.IsEnabled = false;

            ReinstallActionBtn.IsEnabled = false;
            DeleteActionBtn.IsEnabled = false;
        }
        else
        {
            StateEyebrowText.Text = "READY FOR A LOCATION";
            StateTitleText.Text = "Antigravity was not found.";
            StateDescText.Text = "Choose the folder Antigravity is installed in to continue.";

            StateLabelText.Text = "NOT FOUND";
            StateDot.Fill = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#8E918F"));
            StatePillBorder.Background = Brushes.Transparent;
            StatePillBorder.BorderBrush = Brushes.Transparent;
            StatePillBorder.ToolTip = "Not Found";

            InstallIconText.Text = "↓";
            InstallLabelText.Text = "Install SuperGravity";
            InstallHintText.Text = "Locate an Antigravity installation to continue.";
            InstallActionBtn.IsEnabled = false;

            ReinstallActionBtn.IsEnabled = false;
            DeleteActionBtn.IsEnabled = false;
        }
    }

    private void Titlebar_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left)
        {
            DragMove();
        }
    }

    private void Minimize_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private async void ChooseLocation_Click(object sender, RoutedEventArgs e)
    {
        if (_isBusy) return;

        var dialog = new OpenFolderDialog
        {
            Title = "Choose the Antigravity installation folder"
        };

        if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.FolderName))
        {
            var folder = dialog.FolderName;
            if (PatcherBridge.IsAntigravityIdePath(folder))
            {
                _state = await PatcherBridge.InspectAsync(folder);
                UpdateUI();
                return;
            }

            var targetPath = PatcherBridge.FindAntigravityPath(folder) ?? folder;
            _state = await PatcherBridge.InspectAsync(targetPath);
            UpdateUI();
        }
    }

    private async void InstallBtn_Click(object sender, RoutedEventArgs e)
    {
        string op = _state.Kind switch
        {
            "needs-repatch" => "update",
            "corrupted" => "repair",
            _ => "install"
        };

        await ExecuteOperationAsync(op);
    }

    private async void ReinstallBtn_Click(object sender, RoutedEventArgs e)
    {
        await ExecuteOperationAsync("reinstall");
    }

    private async void DeleteBtn_Click(object sender, RoutedEventArgs e)
    {
        await ExecuteOperationAsync("uninstall");
    }

    private async Task ExecuteOperationAsync(string operation)
    {
        if (_isBusy || string.IsNullOrEmpty(_state.Path)) return;

        _isBusy = true;
        SetBusyState(true);

        var (success, message, finalState) = await PatcherBridge.RunOperationAsync(
            operation,
            _state.Path,
            progress =>
            {
                Dispatcher.Invoke(() =>
                {
                    ProgressStageText.Text = progress.Stage.ToUpper();
                    ProgressPercentText.Text = $"{progress.Percent}%";
                    ProgressBarCtrl.Value = progress.Percent;
                    ProgressMsgText.Text = progress.Message;
                });
            });

        _isBusy = false;
        SetBusyState(false);

        if (finalState != null)
        {
            _state = finalState;
        }

        UpdateUI();
        MessageBox.Show(this, message, "SuperGravity Installer", MessageBoxButton.OK,
            success ? MessageBoxImage.Information : MessageBoxImage.Warning);
    }

    private void SetBusyState(bool busy)
    {
        ProgressPanel.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
        ActionsGroupPanel.IsEnabled = !busy;
    }

    private void OpenLog_Click(object sender, RoutedEventArgs e)
    {
        string logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "BetterGravity", "runtime.log");
        if (File.Exists(logPath))
        {
            Process.Start(new ProcessStartInfo(logPath) { UseShellExecute = true });
        }
        else
        {
            MessageBox.Show(this, "No runtime log yet. It appears once Antigravity has run with SuperGravity.", "Runtime Log", MessageBoxButton.OK, MessageBoxImage.Information);
        }
    }
}