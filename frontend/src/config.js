let configPromise;

export function getConfig() {
  if (!configPromise) {
    configPromise = fetch("/config.json")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load config");
        return res.json();
      })
      .catch(() =>
        fetch("https://your-campus-quest-backend.onrender.com/api/config").then(
          (res) => {
            if (!res.ok) throw new Error("Could not load backend config");
            return res.json();
          },
        ),
      );
  }

  return configPromise;
}
