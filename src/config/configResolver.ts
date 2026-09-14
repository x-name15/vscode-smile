/**
 * @fileoverview Configuration resolver for the Smile VS Code extension.
 * Discovers, loads, and caches project-level Smile configurations (config.smile.json, smile.config.json, etc.).
 * Supports walking directory hierarchies up to workspace root and live re-linting on file modifications.
 */

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ISmileConfig } from "@mrjacket/smile";
import type { ISmileResolvedConfig } from "../models/index.js";

/**
 * Standard configuration file names supported by Smile in priority order.
 */
export const CONFIG_FILENAMES: readonly string[] = [
  "config.smile.json",
  "smile.config.json",
  ".smilerc.json",
  "smile.json",
] as const;

/**
 * In-memory cache entry for parsed configuration files.
 */
interface IConfigCacheEntry {
  /** Parsed Smile configuration object. */
  config: ISmileConfig;
  /** File modification timestamp when read. */
  mtimeMs: number;
}

/**
 * Memory cache of loaded configs keyed by absolute file path.
 */
const configCache = new Map<string, IConfigCacheEntry>();

/**
 * Locates a Smile configuration file by searching the directory tree upwards.
 * Starts from `startDir` and traverses parent directories until reaching `stopDir` or system root.
 *
 * @param startDir - The directory where the search starts (e.g. document folder).
 * @param stopDir - Optional boundary directory where traversal must stop (e.g. workspace root).
 * @returns The absolute path to the first matching configuration file, or undefined if none found.
 */
export function findConfigFile(startDir: string, stopDir?: string): string | undefined {
  let currentDir = path.resolve(startDir);
  const normalizedStopDir = stopDir ? path.resolve(stopDir) : undefined;

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidatePath = path.join(currentDir, filename);
      if (fs.existsSync(candidatePath)) {
        try {
          const stat = fs.statSync(candidatePath);
          if (stat.isFile()) {
            return candidatePath;
          }
        } catch {
          // Ignore filesystem errors and continue searching
        }
      }
    }

    // Stop if we have reached the boundary stop directory
    if (normalizedStopDir && currentDir === normalizedStopDir) {
      break;
    }

    const parentDir = path.dirname(currentDir);
    // Stop if we reached filesystem root
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return undefined;
}

/**
 * Reads and parses a JSON Smile configuration file from disk.
 * Uses mtime caching to avoid redundant disk operations on fast keystrokes.
 *
 * @param filePath - Absolute path to the configuration file.
 * @returns The parsed ISmileConfig object, or empty configuration if invalid.
 */
export function loadConfigFile(filePath: string): ISmileConfig {
  try {
    const stat = fs.statSync(filePath);
    const cached = configCache.get(filePath);

    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.config;
    }

    const rawContent = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(rawContent) as ISmileConfig;

    configCache.set(filePath, {
      config: parsed,
      mtimeMs: stat.mtimeMs,
    });

    return parsed;
  } catch (error) {
    console.warn(`[Smile] Warning: Failed to load config from ${filePath}: ${error}`);
    return {};
  }
}

/**
 * Clears the configuration cache.
 * Can clear a specific file path or all cached configurations.
 *
 * @param filePath - Optional specific file path to evict from cache.
 */
export function invalidateConfigCache(filePath?: string): void {
  if (filePath) {
    configCache.delete(filePath);
  } else {
    configCache.clear();
  }
}

/**
 * Resolves the effective Smile project configuration for a given document URI.
 *
 * Resolution precedence:
 * 1. Explicit `smile.configFile` setting from VS Code configuration (if defined and valid).
 * 2. Auto-discovered config file (`config.smile.json`, `smile.config.json`, etc.) from document folder up to workspace root.
 * 3. Default empty configuration `{}` (all linters run under default strict rules).
 *
 * @param documentUri - The URI of the document being linted.
 * @returns A promise resolving to an ISmileResolvedConfig structure.
 */
export async function resolveSmileConfig(documentUri: vscode.Uri): Promise<ISmileResolvedConfig> {
  // If not a local file, return default empty config
  if (documentUri.scheme !== "file") {
    return {
      config: {},
      isCustom: false,
    };
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  const workspaceRoot = workspaceFolder ? workspaceFolder.uri.fsPath : undefined;
  const fileDir = path.dirname(documentUri.fsPath);

  // 1. Check explicit configuration setting
  const userSettings = vscode.workspace.getConfiguration("smile", documentUri);
  const customConfigPath = userSettings.get<string>("configFile");

  if (customConfigPath && customConfigPath.trim() !== "") {
    const resolvedPath = path.isAbsolute(customConfigPath)
      ? customConfigPath
      : workspaceRoot
      ? path.join(workspaceRoot, customConfigPath)
      : path.join(fileDir, customConfigPath);

    if (fs.existsSync(resolvedPath)) {
      const config = loadConfigFile(resolvedPath);
      return {
        config,
        configPath: resolvedPath,
        isCustom: true,
      };
    }
  }

  // 2. Auto-discover config file upwards
  const detectedPath = findConfigFile(fileDir, workspaceRoot);
  if (detectedPath) {
    const config = loadConfigFile(detectedPath);
    return {
      config,
      configPath: detectedPath,
      isCustom: true,
    };
  }

  // 3. Check workspace root specifically (in case file is outside but part of multi-root)
  if (workspaceRoot) {
    for (const filename of CONFIG_FILENAMES) {
      const rootCandidate = path.join(workspaceRoot, filename);
      if (fs.existsSync(rootCandidate)) {
        const config = loadConfigFile(rootCandidate);
        return {
          config,
          configPath: rootCandidate,
          isCustom: true,
        };
      }
    }
  }

  // 4. Default fallback: No custom config found
  return {
    config: {},
    isCustom: false,
  };
}
