import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

// Safe git command execution — uses spawnSync with args array (no shell injection)
export function safeGit(root, args) {
  try {
    const res = spawnSync("git", args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    });
    if (res.status !== 0) {
      const stderr = res.stderr ? String(res.stderr).trim() : "git error";
      return { ok: false, stdout: "", stderr };
    }
    return { ok: true, stdout: String(res.stdout).trim(), stderr: "" };
  } catch (e) {
    return { ok: false, stdout: "", stderr: e.message || "git error" };
  }
}

export function hasGit(root) {
  const gitDir = path.join(root, ".git");
  if (!fs.existsSync(gitDir)) return false;
  const res = safeGit(root, ["rev-parse", "--is-inside-work-tree"]);
  return res.ok;
}

export function getHead(root) {
  const branch = safeGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const commit = safeGit(root, ["rev-parse", "HEAD"]);
  if (!branch.ok || !commit.ok) {
    return { gitBranch: "", gitCommit: "" };
  }
  return {
    gitBranch: branch.stdout,
    gitCommit: commit.stdout,
  };
}

export function getDefaultBranch(root) {
  const res = safeGit(root, ["symbolic-ref", "refs/remotes/origin/HEAD"]);
  if (res.ok) {
    const parts = res.stdout.split("/");
    return parts[parts.length - 1] || "";
  }
  const head = getHead(root);
  return head.gitBranch || "";
}

export function captureDiff(root) {
  const res = safeGit(root, ["diff"]);
  if (!res.ok) return null;
  return res.stdout;
}

export function captureDiffStaged(root) {
  const res = safeGit(root, ["diff", "--cached"]);
  if (!res.ok) return null;
  return res.stdout;
}

// Parse git status --porcelain into structured data
export function captureStatus(root) {
  const branchRes = safeGit(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const commitRes = safeGit(root, ["rev-parse", "--short", "HEAD"]);
  const statusRes = safeGit(root, ["status", "--porcelain"]);

  const branch = branchRes.ok ? branchRes.stdout : "";
  const commit = commitRes.ok ? commitRes.stdout : "";
  const changedFiles = [];

  if (statusRes.ok && statusRes.stdout) {
    const lines = statusRes.stdout.split("\n").filter(Boolean);
    for (const line of lines.slice(0, 50)) {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3);
      changedFiles.push({ status, file });
    }
  }

  return { branch, commit, changedFiles };
}

export function createTag(root, tagName) {
  const res = safeGit(root, ["tag", tagName]);
  if (!res.ok) {
    return { ok: false, tag: "", error: res.stderr };
  }
  return { ok: true, tag: tagName, error: "" };
}

export function getRecentCommits(root, n = 10) {
  const res = safeGit(root, ["log", `--oneline`, `-${n}`]);
  if (!res.ok || !res.stdout) return [];
  return res.stdout.split("\n").filter(Boolean).map((line) => {
    const spaceIdx = line.indexOf(" ");
    return {
      hash: line.substring(0, spaceIdx),
      message: line.substring(spaceIdx + 1),
    };
  });
}

export function getDiffSummary(root) {
  const res = safeGit(root, ["diff", "--stat"]);
  if (!res.ok) return "";
  return res.stdout;
}

export function getStagedFiles(root) {
  const res = safeGit(root, ["diff", "--cached", "--name-only"]);
  if (!res.ok || !res.stdout) return [];
  return res.stdout.split("\n").filter(Boolean);
}
