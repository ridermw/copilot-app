window.AzureAIConstellation = window.AzureAIConstellation || {};

window.AzureAIConstellation.ActivityLog = (() => {
  const { Config } = window.AzureAIConstellation;

  function timestamp() {
    const now = new Date();
    return now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  }

  class ActivityLogController {
    constructor(doc = document) {
      this.doc = doc;
      this.container = doc.getElementById("activity-log");
      this.focusBadge = doc.getElementById("log-focus-badge");
      this.maxEntries = 44;
      this.indexByGroup = {};
      this.lastMessage = "";
    }

    seedInitial() {
      Config.LOG_LIBRARY.idle.forEach((entry, index) => {
        this.append(entry, index === 0 ? "success" : "info");
      });
    }

    setFocus(focus) {
      this.focusBadge.textContent = focus === "log" ? "Focus: launching" : "Focus: training";
    }

    append(message, level = "info") {
      if (!message || message === this.lastMessage) {
        return;
      }

      this.lastMessage = message;
      const row = this.doc.createElement("div");
      row.className = "activity-log__entry";
      row.dataset.level = level;

      const time = this.doc.createElement("span");
      time.className = "activity-log__timestamp";
      time.textContent = timestamp();

      const body = this.doc.createElement("span");
      body.className = "activity-log__message";
      body.textContent = message;

      row.append(time, body);
      this.container.appendChild(row);

      while (this.container.childNodes.length > this.maxEntries) {
        this.container.removeChild(this.container.firstChild);
      }

      this.container.scrollTop = this.container.scrollHeight;
    }

    appendLibraryEntry(group, level = "info") {
      const entries = Config.LOG_LIBRARY[group] || [];
      if (!entries.length) {
        return;
      }

      const currentIndex = this.indexByGroup[group] || 0;
      const message = entries[currentIndex % entries.length];
      this.indexByGroup[group] = currentIndex + 1;
      this.append(message, level);
    }
  }

  return ActivityLogController;
})();
