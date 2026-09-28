// RLStats.exe: one-click setup and launch for the Rocket League stats widget.
//
// Every run it:
//   1. installs (or refreshes) the recorder files in %LOCALAPPDATA%\RLStats\app,
//   2. writes Documents\RLStats\upload.json if it is missing, so matches reach the dashboard,
//   3. checks the game's Stats API is switched on, and offers to switch it on (needs admin),
//   4. puts an "RL Stats" shortcut on the desktop,
//   5. starts the widget, which then keeps itself up to date from the dashboard site.
//
// Built with build.sh; the recorder files and upload.json are embedded as resources.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

[assembly: AssemblyTitle("RL Stats")]
[assembly: AssemblyProduct("RL Stats")]
[assembly: AssemblyDescription("Records Rocket League match stats for the rocketdash dashboard")]
[assembly: AssemblyVersion("1.0.0.0")]

static class Program
{
    const string Title = "RL Stats";
    const uint MB_OK = 0x0, MB_YESNO = 0x4, MB_ICONINFO = 0x40, MB_ICONWARN = 0x30, MB_ICONERROR = 0x10;
    const int IDYES = 6;

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

    static int Box(string text, uint type)
    {
        try { return MessageBoxW(IntPtr.Zero, text, Title, type); }
        catch (Exception) { Console.WriteLine(text); return 0; }   // only off Windows, for testing
    }
    static int Ask(string text, uint icon) { return Box(text, MB_YESNO | icon); }
    static void Tell(string text, uint icon) { Box(text, MB_OK | icon); }

    static string LocalApp { get { return Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData); } }
    static string AppDir { get { return Path.Combine(LocalApp, "RLStats", "app"); } }
    static string DataDir { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "RLStats"); } }

    [STAThread]
    static int Main(string[] args)
    {
        try
        {
            InstallFiles();
            EnsureUploadConfig();
            CheckStatsApi();
            InstallShortcut();
            StartWidget();
            return 0;
        }
        catch (Exception e)
        {
            Tell("RL Stats could not start.\n\n" + e.Message, MB_ICONERROR);
            return 1;
        }
    }

    // ---- 1. files ----------------------------------------------------------------------------
    static void InstallFiles()
    {
        Directory.CreateDirectory(AppDir);
        Assembly asm = Assembly.GetExecutingAssembly();
        string stamp = BuildStamp(asm);
        string stampFile = Path.Combine(AppDir, ".installed-by");
        bool refresh = !File.Exists(stampFile) || File.ReadAllText(stampFile).Trim() != stamp;
        foreach (string res in asm.GetManifestResourceNames())
        {
            if (!res.StartsWith("app/")) continue;
            string name = res.Substring(4);
            string dest = Path.Combine(AppDir, name);
            // A newer exe replaces everything; otherwise only missing files are restored, so
            // files the widget's self-updater installed are left alone.
            if (!refresh && File.Exists(dest)) continue;
            WriteResource(asm, res, dest);
        }
        File.WriteAllText(stampFile, stamp);

        // Keep a copy of this exe next to the app, so the desktop shortcut survives Downloads being cleared.
        string self = asm.Location;
        string copy = Path.Combine(LocalApp, "RLStats", "RLStats.exe");
        if (!string.Equals(Path.GetFullPath(self), Path.GetFullPath(copy), StringComparison.OrdinalIgnoreCase))
        {
            try { File.Copy(self, copy, true); } catch (IOException) { }
        }
    }

    static string BuildStamp(Assembly asm)
    {
        using (Stream s = asm.GetManifestResourceStream("build-stamp.txt"))
        using (StreamReader r = new StreamReader(s)) return r.ReadToEnd().Trim();
    }

    static void WriteResource(Assembly asm, string res, string dest)
    {
        using (Stream s = asm.GetManifestResourceStream(res))
        using (FileStream f = File.Create(dest)) s.CopyTo(f);
    }

    // ---- 2. uploads --------------------------------------------------------------------------
    static void EnsureUploadConfig()
    {
        Directory.CreateDirectory(DataDir);
        string dest = Path.Combine(DataDir, "upload.json");
        if (File.Exists(dest)) return;
        WriteResource(Assembly.GetExecutingAssembly(), "upload.json", dest);
    }

    // ---- 3. Stats API ------------------------------------------------------------------------
    static void CheckStatsApi()
    {
        string config = FindConfigDir();
        if (config == null)
        {
            Tell("Couldn't find Rocket League's install folder, so the stats feed wasn't checked.\n\n" +
                 "If the widget says \"Stats API is off\", run \"Enable Stats API.bat\" from:\n" + AppDir, MB_ICONWARN);
            return;
        }
        if (StatsApiOn(config)) return;

        string running = Process.GetProcessesByName("RocketLeague").Length > 0
            ? "\n\nRocket League is open. Close it first, because it only reads this setting when it starts." : "";
        if (Ask("Rocket League's stats feed is switched off, so no matches can be recorded.\n\n" +
                "Switch it on now? Windows will ask for permission." + running, MB_ICONWARN) != IDYES) return;

        ProcessStartInfo psi = new ProcessStartInfo("powershell.exe",
            "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + Path.Combine(AppDir, "EnableStatsAPI.ps1") +
            "\" -ConfigDir \"" + config + "\"");
        psi.Verb = "runas";
        psi.UseShellExecute = true;
        psi.WindowStyle = ProcessWindowStyle.Hidden;
        try
        {
            using (Process p = Process.Start(psi)) p.WaitForExit();
        }
        catch (System.ComponentModel.Win32Exception)
        {
            Tell("The stats feed was not switched on, because Windows permission was declined.\n" +
                 "Run RL Stats again to retry.", MB_ICONWARN);
            return;
        }
        if (StatsApiOn(config))
            Tell("Stats feed switched on. If Rocket League was open, restart it before you play.", MB_ICONINFO);
        else
            Tell("The stats feed still looks switched off. Run \"Enable Stats API.bat\" from:\n" + AppDir, MB_ICONWARN);
    }

    static bool StatsApiOn(string config)
    {
        foreach (string name in new[] { "TAStatsAPI.ini", "DefaultStatsAPI.ini" })
        {
            string ini = Path.Combine(config, name);
            if (!File.Exists(ini)) continue;
            Match m = Regex.Match(File.ReadAllText(ini), @"(?m)^\s*PacketSendRate\s*=\s*(\d+)");
            if (m.Success) return int.Parse(m.Groups[1].Value) > 0;
        }
        return false;
    }

    static string FindConfigDir()
    {
        var candidates = new System.Collections.Generic.List<string>();
        // Epic records every install location in LauncherInstalled.dat; Rocket League's app name is "Sugar".
        string dat = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
            "Epic", "UnrealEngineLauncher", "LauncherInstalled.dat");
        if (File.Exists(dat))
        {
            string text = File.ReadAllText(dat);
            foreach (Match m in Regex.Matches(text, "\\{[^{}]*\\}"))
            {
                if (!Regex.IsMatch(m.Value, "\"AppName\"\\s*:\\s*\"Sugar\"")) continue;
                Match loc = Regex.Match(m.Value, "\"InstallLocation\"\\s*:\\s*\"([^\"]+)\"");
                if (loc.Success) candidates.Add(loc.Groups[1].Value.Replace("\\\\", "\\").Replace("/", "\\"));
            }
        }
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        candidates.Add(Path.Combine(pf, "Epic Games", "rocketleague"));
        candidates.Add(Path.Combine(pf86, "Steam", "steamapps", "common", "rocketleague"));
        foreach (string root in candidates)
        {
            string config = Path.Combine(root, "TAGame", "Config");
            if (Directory.Exists(config)) return config;
        }
        return null;
    }

    // ---- 4. shortcut -------------------------------------------------------------------------
    static void InstallShortcut()
    {
        try
        {
            string lnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "RL Stats.lnk");
            if (File.Exists(lnk)) return;
            string target = Path.Combine(LocalApp, "RLStats", "RLStats.exe");
            if (!File.Exists(target)) return;
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(shellType);
            object sc = shellType.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, shell, new object[] { lnk });
            Type t = sc.GetType();
            t.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { target });
            t.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { Path.GetDirectoryName(target) });
            t.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { "Record Rocket League stats" });
            t.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
        }
        catch (Exception) { /* a missing shortcut is not worth stopping for */ }
    }

    // ---- 5. widget ---------------------------------------------------------------------------
    static void StartWidget()
    {
        // The widget refuses to start a second copy and says so itself.
        ProcessStartInfo psi = new ProcessStartInfo("powershell.exe",
            "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File \"" + Path.Combine(AppDir, "RLStatsWidget.ps1") + "\"");
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.WorkingDirectory = AppDir;
        Process.Start(psi);
    }
}
