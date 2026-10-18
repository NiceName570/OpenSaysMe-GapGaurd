using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace GapGuardSetup
{
    internal static class Program
    {
        [STAThread]
        private static int Main(string[] args)
        {
            if (args.Length == 2 && args[0] == "--self-check")
            {
                try { File.WriteAllText(args[1], Payload.Verify(), new UTF8Encoding(false)); return 0; }
                catch (Exception error) { File.WriteAllText(args[1], error.ToString()); return 1; }
            }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            if (args.Length == 2 && args[0] == "--preview")
            {
                using (var form = new SetupForm())
                using (var bitmap = new Bitmap(form.Width, form.Height))
                {
                    // Make children layout-visible while keeping the preview window invisible.
                    form.Opacity = 0; form.ShowInTaskbar = false;
                    form.Show(); Application.DoEvents(); form.PerformLayout();
                    form.DrawToBitmap(bitmap, new Rectangle(0, 0, bitmap.Width, bitmap.Height));
                    bitmap.Save(args[1], System.Drawing.Imaging.ImageFormat.Png);
                    form.Hide();
                }
                return 0;
            }
            Application.Run(new SetupForm());
            return 0;
        }
    }

    internal static class Payload
    {
        internal static Stream Open()
        {
            var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("GapGuard.Payload.zip");
            if (stream == null) throw new InvalidDataException("The embedded extension package is missing.");
            return stream;
        }

        internal static string Hash(Stream stream)
        {
            using (var algorithm = SHA256.Create())
                return BitConverter.ToString(algorithm.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
        }

        internal static string Verify()
        {
            using (var stream = Open())
                if (Hash(stream) != BuildInfo.PayloadSha256) throw new InvalidDataException("Package integrity check failed.");
            int files = 0;
            long bytes = 0;
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            using (var stream = Open())
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                foreach (var entry in zip.Entries)
                {
                    ValidateName(entry.FullName);
                    if (!seen.Add(entry.FullName)) throw new InvalidDataException("Duplicate package path.");
                    using (var input = entry.Open())
                    using (var sink = Stream.Null) input.CopyTo(sink);
                    files++;
                    bytes += entry.Length;
                }
            }
            foreach (var expected in new[] { "extension/manifest.json", "extension/background.js", "extension/icons/icon-128.png", "extension/filters/declarative/ruleset_0/ruleset_0.json", "source/package.json", "source/LICENSE", "source/installer/GapGuardSetup.cs" })
                if (!seen.Contains(expected)) throw new InvalidDataException("Missing packaged file: " + expected);
            return "{\"status\":\"passed\",\"version\":\"" + BuildInfo.Version + "\",\"payloadSha256\":\"" + BuildInfo.PayloadSha256 + "\",\"files\":" + files + ",\"uncompressedBytes\":" + bytes + "}";
        }

        private static void ValidateName(string name)
        {
            if (!(name.StartsWith("extension/", StringComparison.Ordinal) || name.StartsWith("source/", StringComparison.Ordinal)) ||
                name.Contains("\\") || name.Contains(":") || name.Split('/').Any(part => part == ".." || part == "."))
                throw new InvalidDataException("Invalid package path: " + name);
        }

        internal static void Install(string root, Action<int> progress)
        {
            Verify();
            root = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar);
            if (Directory.Exists(root) && Directory.EnumerateFileSystemEntries(root).Any())
            {
                string existing = Path.Combine(root, "extension", "manifest.json");
                if (!File.Exists(existing) || !File.ReadAllText(existing).Contains("GapGuard"))
                    throw new IOException("That folder already contains other files. Choose an empty folder or an existing GapGuard installation.");
            }
            Directory.CreateDirectory(root);
            RejectLink(root);
            using (var stream = Open())
            using (var zip = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                int count = 0;
                foreach (var entry in zip.Entries)
                {
                    ValidateName(entry.FullName);
                    string target = Path.GetFullPath(Path.Combine(root, entry.FullName.Replace('/', Path.DirectorySeparatorChar)));
                    if (!target.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                        throw new InvalidDataException("Package path escapes the installation folder.");
                    string parent = Path.GetDirectoryName(target);
                    for (string part = parent; part != null && part.Length >= root.Length; part = Path.GetDirectoryName(part))
                        RejectLink(part);
                    RejectLink(target);
                    Directory.CreateDirectory(parent);
                    using (var input = entry.Open())
                    using (var output = new FileStream(target, FileMode.Create, FileAccess.Write, FileShare.None)) input.CopyTo(output);
                    progress(++count * 100 / zip.Entries.Count);
                }
            }
            File.WriteAllText(Path.Combine(root, "START_HERE.txt"),
                "GapGuard " + BuildInfo.Version + "\r\n\r\n" +
                "1. Open edge://extensions in Microsoft Edge.\r\n" +
                "2. Enable Developer mode.\r\n" +
                "3. Click Load unpacked and select:\r\n" + Path.Combine(root, "extension") + "\r\n" +
                "4. Open GapGuard and check that its status says Ready.\r\n" +
                "5. Reload open websites.\r\n\r\n" +
                "Keep this folder in place while using GapGuard.\r\n" +
                "Source code, licenses, and build instructions are in the source folder.\r\n" +
                "This setup does not change browser policies or automatically add the extension.\r\n", new UTF8Encoding(false));
        }

        private static void RejectLink(string path)
        {
            if ((Directory.Exists(path) || File.Exists(path)) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
                throw new IOException("The installation path contains a link or junction. Choose a regular folder.");
        }
    }

    internal sealed class SetupForm : Form
    {
        private readonly Color ink = Color.FromArgb(12, 18, 24);
        private readonly Color mint = Color.FromArgb(117, 225, 188);
        private readonly TextBox destination = new TextBox();
        private readonly Label status = new Label();
        private readonly Button install = new Button();
        private readonly Button browse = new Button();
        private readonly Button edge = new Button();
        private readonly Button folder = new Button();
        private readonly Button copy = new Button();
        private readonly ProgressBar progress = new ProgressBar();
        private bool installing;

        internal SetupForm()
        {
            Text = "GapGuard Setup " + BuildInfo.Version;
            ClientSize = new Size(800, 710);
            MinimumSize = new Size(760, 690);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = ink;
            ForeColor = Color.FromArgb(230, 237, 243);
            Font = new Font("Segoe UI", 10);
            AutoScaleMode = AutoScaleMode.Font;
            using (var icon = Assembly.GetExecutingAssembly().GetManifestResourceStream("GapGuard.Icon.ico"))
                if (icon != null) using (var original = new Icon(icon)) Icon = (Icon)original.Clone();

            var banner = new PictureBox { Dock = DockStyle.Top, Height = 205, SizeMode = PictureBoxSizeMode.Zoom, BackColor = ink };
            using (var image = Assembly.GetExecutingAssembly().GetManifestResourceStream("GapGuard.Banner.png"))
                if (image != null) using (var original = new Bitmap(image)) banner.Image = new Bitmap(original);

            var content = new TableLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(26, 12, 26, 18), ColumnCount = 1, AutoScroll = true };
            content.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            AddRow(content, new Label { Text = "Set up GapGuard for Edge", Font = new Font("Segoe UI", 19, FontStyle.Bold), AutoSize = true, Margin = new Padding(0, 0, 0, 8) });
            AddRow(content, new Label { Text = "Place the extension and its source on this PC, then load it in Edge. No administrator access required.", AutoSize = true, MaximumSize = new Size(720, 0), ForeColor = Color.FromArgb(154, 175, 191), Margin = new Padding(0, 0, 0, 16) });
            var location = new TableLayoutPanel { Dock = DockStyle.Top, ColumnCount = 2, Height = 38, Margin = new Padding(0, 0, 0, 12) };
            location.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100)); location.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 105));
            destination.Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GapGuard");
            destination.ReadOnly = true; destination.Dock = DockStyle.Fill; destination.BackColor = Color.FromArgb(20, 30, 40); destination.ForeColor = ForeColor; destination.BorderStyle = BorderStyle.FixedSingle;
            Style(browse, "Choose…", false); browse.Dock = DockStyle.Fill;
            browse.Click += delegate { using (var dialog = new FolderBrowserDialog { Description = "Choose a parent folder. GapGuard will use a GapGuard subfolder." }) if (dialog.ShowDialog(this) == DialogResult.OK) destination.Text = Path.Combine(dialog.SelectedPath, "GapGuard"); };
            location.Controls.Add(destination, 0, 0); location.Controls.Add(browse, 1, 0); AddRow(content, location);

            Style(install, "Install / update GapGuard", true); install.Height = 42; install.Dock = DockStyle.Top; install.Margin = new Padding(0, 0, 0, 12);
            install.Click += InstallClick; AddRow(content, install);
            progress.Dock = DockStyle.Top; progress.Height = 8; progress.Margin = new Padding(0, 0, 0, 16); AddRow(content, progress);
            AddRow(content, new Label { Text = "Finish in Edge\r\n1. Open the extensions page and enable Developer mode.\r\n2. Click Load unpacked and select the extension folder.\r\n3. Check that GapGuard says Ready, then reload your websites.", AutoSize = true, MaximumSize = new Size(720, 0), Margin = new Padding(0, 0, 0, 14) });

            var actions = new FlowLayoutPanel { Dock = DockStyle.Top, AutoSize = true, WrapContents = true, Margin = new Padding(0, 0, 0, 10) };
            Style(edge, "Open Edge extensions", false); Style(folder, "Open extension folder", false); Style(copy, "Copy folder path", false);
            edge.Enabled = folder.Enabled = copy.Enabled = false;
            edge.Click += delegate { TryAction(OpenEdge); };
            folder.Click += delegate { TryAction(() => System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "explorer.exe"), "\"" + ExtensionFolder + "\"") { UseShellExecute = true })); };
            copy.Click += delegate { TryAction(() => { Clipboard.SetText(ExtensionFolder); status.Text = "Extension folder path copied. Paste it into Edge's folder picker."; }); };
            actions.Controls.Add(edge); actions.Controls.Add(folder); actions.Controls.Add(copy); AddRow(content, actions);
            status.AutoSize = true; status.MaximumSize = new Size(720, 0); status.ForeColor = mint; status.Text = "The extension will stay in this folder. Keep it in place after setup."; AddRow(content, status);
            Controls.Add(content); Controls.Add(banner);
            FormClosing += delegate(object sender, FormClosingEventArgs args)
            {
                if (installing) { args.Cancel = true; status.Text = "Setup is still placing files. This window can close when it finishes."; }
            };
        }

        private string ExtensionFolder { get { return Path.Combine(destination.Text, "extension"); } }

        private void Style(Button button, string text, bool primary)
        {
            button.Text = text; button.AutoSize = true; button.MinimumSize = new Size(0, 36); button.Padding = new Padding(12, 6, 12, 6);
            button.FlatStyle = FlatStyle.Flat; button.FlatAppearance.BorderSize = primary ? 0 : 1;
            button.FlatAppearance.BorderColor = Color.FromArgb(55, 75, 90);
            button.BackColor = primary ? mint : Color.FromArgb(29, 44, 56);
            button.ForeColor = primary ? Color.FromArgb(12, 39, 32) : ForeColor;
            button.Font = new Font(Font, FontStyle.Bold); button.Cursor = Cursors.Hand;
        }

        private static void AddRow(TableLayoutPanel panel, Control control)
        {
            panel.RowStyles.Add(new RowStyle(SizeType.AutoSize));
            panel.Controls.Add(control, 0, panel.RowCount++);
        }

        private async void InstallClick(object sender, EventArgs args)
        {
            installing = true;
            install.Enabled = browse.Enabled = edge.Enabled = folder.Enabled = copy.Enabled = false;
            status.ForeColor = mint; status.Text = "Checking package and placing files…";
            string target = destination.Text;
            var reporter = new Progress<int>(value => progress.Value = value);
            try
            {
                await Task.Run(() => Payload.Install(target, value => ((IProgress<int>)reporter).Report(value)));
                progress.Value = 100;
                status.Text = "Files are ready. Use the buttons above to finish loading GapGuard in Edge.";
                edge.Enabled = folder.Enabled = copy.Enabled = true;
            }
            catch (Exception error) { status.ForeColor = Color.FromArgb(255, 170, 165); status.Text = "Setup did not finish: " + error.Message; }
            finally { installing = false; install.Enabled = browse.Enabled = true; }
        }

        private void TryAction(Action action)
        {
            try { action(); }
            catch (Exception error) { status.ForeColor = Color.FromArgb(255, 170, 165); status.Text = error.Message; }
        }

        private void OpenEdge()
        {
            foreach (string parent in new[] { Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) })
            {
                string path = Path.Combine(parent, "Microsoft", "Edge", "Application", "msedge.exe");
                if (File.Exists(path)) { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(path, "edge://extensions") { UseShellExecute = true }); return; }
            }
            status.Text = "Open Microsoft Edge yourself and enter edge://extensions in the address bar.";
        }
    }
}
