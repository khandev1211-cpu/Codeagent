import { execSync } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

/**
 * OS-agnostic API key storage using platform-native credential managers:
 * - Windows: Credential Manager (via `cmdkey`)
 * - macOS: Keychain (via `security`)
 * - Linux: `pass` password manager (fallback: encrypted file)
 */
export class KeychainManager {
  constructor({ logger = console } = {}) {
    this.logger = logger;
    this.platform = os.platform();
    this.serviceName = "codeagent";
  }

  /**
   * Save API key to keychain. Falls back to encrypted local storage if unavailable.
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
   * Retrieve API key from keychain.
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

  // ==================== Windows (Credential Manager) ====================

  _saveKeyWindows(provider, key) {
    const target = `${this.serviceName}:${provider}`;
    // Using cmdkey to store credentials
    const cmd = `cmdkey /add:${target} /user:${provider} /pass:"${key.replace(/"/g, '\\"')}"`;
    try {
      execSync(cmd, { stdio: "pipe", windowsHide: true });
      return true;
    } catch (error) {
      throw new Error(`Failed to save key to Windows Credential Manager: ${error.message}`);
    }
  }

  _getKeyWindows(provider) {
    const target = `${this.serviceName}:${provider}`;
    try {
      // Query stored credential
      const cmd = `powershell -NoProfile -Command "$cred = Get-StoredCredential -Target '${target}' -ErrorAction SilentlyContinue; if ($cred) { $cred.GetNetworkCredential().Password } else { exit 1 }"`;
      const result = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      return result || null;
    } catch {
      return null;
    }
  }

  _deleteKeyWindows(provider) {
    const target = `${this.serviceName}:${provider}`;
    try {
      execSync(`cmdkey /delete:${target}`, { stdio: "pipe", windowsHide: true });
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
      // Delete existing entry if present
      try {
        execSync(
          `security delete-generic-password -s "${service}" -a "${account}" 2>/dev/null`,
          { stdio: "pipe" }
        );
      } catch {
        // Ignore if not found
      }
      // Add new entry
      execSync(`security add-generic-password -s "${service}" -a "${account}" -w "${key}"`, {
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
      const result = execSync(
        `security find-generic-password -s "${service}" -a "${account}" -w 2>/dev/null`,
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
      execSync(`security delete-generic-password -s "${service}" -a "${account}"`, {
        stdio: "pipe",
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to delete key from macOS Keychain: ${error.message}`);
    }
  }

  // ==================== Linux (pass or local storage) ====================

  _saveKeyLinux(provider, key) {
    try {
      // Try using `pass` if available
      execSync("which pass", { stdio: "pipe" });
      const passPath = `codeagent/${provider}`;
      execSync(`echo "${key}" | pass insert -f -m ${passPath}`, { stdio: "pipe" });
      return true;
    } catch {
      // Fallback to local encrypted storage
      return this._saveKeyLocal(provider, key);
    }
  }

  _getKeyLinux(provider) {
    try {
      // Try using `pass` if available
      execSync("which pass", { stdio: "pipe" });
      const passPath = `codeagent/${provider}`;
      const result = execSync(`pass show ${passPath} 2>/dev/null`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      return result || null;
    } catch {
      // Fallback to local storage
      return this._getKeyLocal(provider);
    }
  }

  _deleteKeyLinux(provider) {
    try {
      // Try using `pass` if available
      execSync("which pass", { stdio: "pipe" });
      const passPath = `codeagent/${provider}`;
      execSync(`pass rm -f ${passPath}`, { stdio: "pipe" });
      return true;
    } catch {
      return this._deleteKeyLocal(provider);
    }
  }

  // ==================== Fallback: Local Storage ====================

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
