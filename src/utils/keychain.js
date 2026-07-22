import { execFileSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

/**
 * OS-agnostic API key storage using platform-native credential managers:
 * - Windows: Credential Manager (via `cmdkey`)
 * - macOS: Keychain (via `security`)
 * - Linux: `pass` password manager (fallback: local file, 0600 permissions)
 *
 * Every shell-out uses execFileSync with an argument array (never a
 * string handed to a shell), and secret values are passed via argv or
 * stdin — never interpolated into a command string. An API key can
 * contain any character (quotes, backticks, `$()`, `;`) without risk of
 * it being interpreted as shell syntax.
 */
export class KeychainManager {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.platform = os.platform();
    this.serviceName = "codeagent";
  }

  /**
   * Save API key to keychain. Falls back to local storage if unavailable.
   */
  async saveKey(provider, key) {
    try {
      if (this.platform === "win32") {
        return this._saveKeyWindows(provider, key);
      } else if (this.platform === "darwin") {
        return this._saveKeyMacOS(provider, key);
      } else {
        return this._saveKeyLinux(provider, key);
      }
    } catch (error) {
      this.logger.warn(`Keychain save failed for ${provider}, falling back to local storage:`, error.message);
      return this._saveKeyLocal(provider, key);
    }
  }

  /**
   * Retrieve API key from keychain. This is the read half of what used to
   * be a write-only operation — see providers/resolveApiKey.js for where
   * it's actually consulted at runtime now.
   */
  async getKey(provider) {
    try {
      if (this.platform === "win32") {
        return this._getKeyWindows(provider);
      } else if (this.platform === "darwin") {
        return this._getKeyMacOS(provider);
      } else {
        return this._getKeyLinux(provider);
      }
    } catch (error) {
      this.logger.debug(`Keychain retrieval failed for ${provider}, trying local storage:`, error.message);
      return this._getKeyLocal(provider);
    }
  }

  /**
   * Delete key from keychain.
   */
  async deleteKey(provider) {
    try {
      if (this.platform === "win32") {
        return this._deleteKeyWindows(provider);
      } else if (this.platform === "darwin") {
        return this._deleteKeyMacOS(provider);
      } else {
        return this._deleteKeyLinux(provider);
      }
    } catch (error) {
      this.logger.warn(`Keychain delete failed for ${provider}:`, error.message);
      return this._deleteKeyLocal(provider);
    }
  }

  /** Which providers currently have a key stored somewhere this manager can see. */
  async listConfiguredProviders(candidateProviders) {
    const found = [];
    for (const provider of candidateProviders) {
      const key = await this.getKey(provider).catch(() => null);
      if (key) found.push(provider);
    }
    return found;
  }

  // ==================== Windows (Credential Manager) ====================

  _saveKeyWindows(provider, key) {
    const target = `${this.serviceName}:${provider}`;
    try {
      execFileSync("cmdkey", [`/add:${target}`, `/user:${provider}`, `/pass:${key}`], {
        stdio: "pipe",
        windowsHide: true,
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to save key to Windows Credential Manager: ${error.message}`);
    }
  }

  _getKeyWindows(provider) {
    const target = `${this.serviceName}:${provider}`;
    try {
      const psCommand = `$cred = Get-StoredCredential -Target '${target}' -ErrorAction SilentlyContinue; if ($cred) { $cred.GetNetworkCredential().Password } else { exit 1 }`;
      const result = execFileSync("powershell", ["-NoProfile", "-Command", psCommand], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      }).trim();
    const code = `
      using System;
      using System.Runtime.InteropServices;
      public class Cred {
        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern bool CredRead(string target, uint type, uint reservedFlags, out IntPtr credentialPtr);
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct Credential { public uint flags, type; public string targetName, comment; public System.Runtime.InteropServices.ComTypes.FILETIME lastWritten; public uint credentialBlobSize; public IntPtr credentialBlob; public uint persist, attributeCount; public IntPtr attributes; public string targetAlias, userName; }
        public static void Main(string[] args) {
          if (CredRead("${target}", 1, 0, out IntPtr ptr)) {
            var cred = (Credential)Marshal.PtrToStructure(ptr, typeof(Credential));
            Console.Write(Marshal.PtrToStringUni(cred.credentialBlob, (int)cred.credentialBlobSize / 2));
          }
        }
      }
    `;
    try {
      return execFileSync("powershell", ["-NoProfile", "-Command", `Add-Type -TypeDefinition '${code}'; [Cred]::Main()`], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      }).trim() || null;
    } catch {
      return null;
    }
  }

  _deleteKeyWindows(provider) {
    const target = `${this.serviceName}:${provider}`;
    try {
      execFileSync("cmdkey", [`/delete:${target}`], { stdio: "pipe", windowsHide: true });
      return true;
    } catch (error) {
      throw new Error(`Failed to delete key from Windows Credential Manager: ${error.message}`);
    }
  }

  // ==================== macOS (Keychain) ====================

  _saveKeyMacOS(provider, key) {
    const account = provider;
    const service = this.serviceName;
    try {
      try {
        execFileSync("security", ["delete-generic-password", "-s", service, "-a", account], { stdio: "pipe" });
      } catch {
        // Ignore if not found
      }
      execFileSync("security", ["add-generic-password", "-s", service, "-a", account, "-w", key], {
        stdio: "pipe",
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to save key to macOS Keychain: ${error.message}`);
    }
  }

  _getKeyMacOS(provider) {
    const account = provider;
    const service = this.serviceName;
    try {
      const result = execFileSync(
        "security",
        ["find-generic-password", "-s", service, "-a", account, "-w"],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
      return result || null;
    } catch {
      return null;
    }
  }

  _deleteKeyMacOS(provider) {
    const account = provider;
    const service = this.serviceName;
    try {
      execFileSync("security", ["delete-generic-password", "-s", service, "-a", account], { stdio: "pipe" });
      return true;
    } catch (error) {
      throw new Error(`Failed to delete key from macOS Keychain: ${error.message}`);
    }
  }

  // ==================== Linux (pass or local storage) ====================

  _saveKeyLinux(provider, key) {
    try {
      execFileSync("which", ["pass"], { stdio: "pipe" });
      const passPath = `codeagent/${provider}`;
      // `pass insert -f -m <path>` reads the secret from stdin until EOF —
      // passing it via `input` avoids ever building a shell command string
      // out of the key (the old code did `echo "${key}" | pass insert`,
      // which was both a shell-injection risk and mangled keys containing
      // certain characters).
      execFileSync("pass", ["insert", "-f", "-m", passPath], { input: key, stdio: ["pipe", "pipe", "pipe"] });
      return true;
    } catch {
      return this._saveKeyLocal(provider, key);
    }
  }

  _getKeyLinux(provider) {
    try {
      execFileSync("which", ["pass"], { stdio: "pipe" });
      const passPath = `codeagent/${provider}`;
      const result = execFileSync("pass", ["show", passPath], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      return result || null;
    } catch {
      return this._getKeyLocal(provider);
    }
  }

  _deleteKeyLinux(provider) {
    try {
      execFileSync("which", ["pass"], { stdio: "pipe" });
      const passPath = `codeagent/${provider}`;
      execFileSync("pass", ["rm", "-f", passPath], { stdio: "pipe" });
      return true;
    } catch {
      return this._deleteKeyLocal(provider);
    }
  }

  // ==================== Fallback: Local Storage ====================
  // Note: this is permission-restricted (0600) plaintext, not encryption —
  // it's a last-resort fallback for platforms with no credential manager
  // and no `pass`, not intended as the primary storage mechanism.

  _getKeysFile() {
    const configDir = path.join(os.homedir(), ".codeagent");
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }
    return path.join(configDir, ".keys.json");
  }

  _saveKeyLocal(provider, key) {
    const keysFile = this._getKeysFile();
    let keys = {};
    try {
      if (fs.existsSync(keysFile)) {
        keys = JSON.parse(fs.readFileSync(keysFile, "utf-8"));
      }
    } catch {
      // Ignore parse errors
    }
    keys[provider] = key;
    fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), { mode: 0o600 });
    return true;
  }

  _getKeyLocal(provider) {
    const keysFile = this._getKeysFile();
    try {
      if (!fs.existsSync(keysFile)) return null;
      const keys = JSON.parse(fs.readFileSync(keysFile, "utf-8"));
      return keys[provider] || null;
    } catch {
      return null;
    }
  }

  _deleteKeyLocal(provider) {
    const keysFile = this._getKeysFile();
    try {
      if (!fs.existsSync(keysFile)) return true;
      const keys = JSON.parse(fs.readFileSync(keysFile, "utf-8"));
      delete keys[provider];
      fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2), { mode: 0o600 });
      return true;
    } catch {
      return false;
    }
  }
}
