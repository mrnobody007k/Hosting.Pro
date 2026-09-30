const os = require("node:os");

if (process.platform === "win32") {
  const preloadPath = __filename.replace(/\\/g, "/");
  const preloadOption = `--require="${preloadPath}"`;
  if (!process.env.NODE_OPTIONS?.includes(__filename)) {
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ""} ${preloadOption}`.trim();
  }

  const userInfo = os.userInfo;
  os.userInfo = (...args) => {
    try {
      return userInfo(...args);
    } catch (error) {
      if (error?.code !== "ERR_SYSTEM_ERROR") throw error;
      return {
        username: process.env.USERNAME || "local-user",
        uid: -1,
        gid: -1,
        shell: null,
        homedir: os.homedir(),
      };
    }
  };
}
