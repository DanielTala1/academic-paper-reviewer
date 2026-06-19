const STORAGE_KEY = "groq_api_key";
const GEMINI_STORAGE_KEY = "gemini_api_key";
const QUESTIONING_KEY = "questioning_mode";
const DRIVE_LINK_KEY = "drive_reference_link";
const PROVIDER_KEY = "ai_provider";

const form = document.getElementById("review-form");
const apiKeyInput = document.getElementById("api-key");
const geminiKeyInput = document.getElementById("gemini-api-key");
const aiProviderSelect = document.getElementById("ai-provider");
const toggleKeyBtn = document.getElementById("toggle-key");
const toggleGeminiKeyBtn = document.getElementById("toggle-gemini-key");
const fileInput = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const browseBtn = document.getElementById("browse-btn");
const fileInfo = document.getElementById("file-info");
const submitBtn = document.getElementById("submit-btn");

const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const reviewContent = document.getElementById("review-content");
const metaInfo = document.getElementById("meta-info");

const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");
const clearChatBtn = document.getElementById("clear-chat-btn");
const chatContextBadge = document.getElementById("chat-context-badge");
const questioningModeSelect = document.getElementById("questioning-mode");
const driveLinkInput = document.getElementById("drive-link");
const loadReferenceBtn = document.getElementById("load-reference-btn");
const referenceStatus = document.getElementById("reference-status");
const chatReferenceBadge = document.getElementById("chat-reference-badge");
const journalInput = document.getElementById("journal-input");
const journalDropZone = document.getElementById("journal-drop-zone");
const journalBrowseBtn = document.getElementById("journal-browse-btn");
const journalInfo = document.getElementById("journal-info");
const chatJournalBadge = document.getElementById("chat-journal-badge");
const questionnaireInput = document.getElementById("questionnaire-input");
const questionnaireDropZone = document.getElementById("questionnaire-drop-zone");
const questionnaireBrowseBtn = document.getElementById("questionnaire-browse-btn");
const questionnaireInfo = document.getElementById("questionnaire-info");
const critiqueQuestionnaireCheckbox = document.getElementById("critique-questionnaire");
const chatQuestionnaireBadge = document.getElementById("chat-questionnaire-badge");

let selectedFile = null;
let selectedJournal = null;
let lastReview = "";
let lastFilename = "";
let lastPaperExcerpt = "";
let lastReferenceLink = "";
let lastReferenceExcerpt = "";
let referenceLoaded = false;
let lastJournalExcerpt = "";
let lastJournalFilename = "";
let journalLoaded = false;
let selectedQuestionnaire = null;
let lastQuestionnaireExcerpt = "";
let lastQuestionnaireFilename = "";
let questionnaireLoaded = false;
let questionnaireCritiqueEnabled = false;
let chatHistory = [];
let chatSending = false;
let lastProvider = "";

function loadApiKey() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) apiKeyInput.value = saved;
  const geminiSaved = localStorage.getItem(GEMINI_STORAGE_KEY);
  if (geminiSaved) geminiKeyInput.value = geminiSaved;
  const providerSaved = localStorage.getItem(PROVIDER_KEY);
  if (providerSaved && aiProviderSelect.querySelector(`option[value="${providerSaved}"]`)) {
    aiProviderSelect.value = providerSaved;
  }
}

function saveApiKeys() {
  const groq = apiKeyInput.value.trim();
  const gemini = geminiKeyInput.value.trim();
  if (groq) localStorage.setItem(STORAGE_KEY, groq);
  if (gemini) localStorage.setItem(GEMINI_STORAGE_KEY, gemini);
  localStorage.setItem(PROVIDER_KEY, aiProviderSelect.value);
}

function getGroqKey() {
  return apiKeyInput.value.trim();
}

function getGeminiKey() {
  return geminiKeyInput.value.trim();
}

function getAiProvider() {
  return aiProviderSelect.value;
}

function appendProviderFields(formData) {
  formData.append("groq_api_key", getGroqKey());
  formData.append("gemini_api_key", getGeminiKey());
  formData.append("ai_provider", getAiProvider());
  formData.append("api_key", getGroqKey());
}

function validateApiKeys() {
  saveApiKeys();
  const provider = getAiProvider();
  const hasGroq = Boolean(getGroqKey());
  const hasGemini = Boolean(getGeminiKey());

  if (provider === "gemini" && !hasGemini) {
    showError("Please enter your Gemini API key (free at aistudio.google.com/apikey).");
    return false;
  }
  if (provider === "groq" && !hasGroq) {
    showError("Please enter your Groq API key.");
    return false;
  }
  if (provider === "auto" && !hasGemini && !hasGroq) {
    showError("Enter a Gemini key (recommended) or Groq key.");
    return false;
  }
  return true;
}

function loadQuestioningMode() {
  const saved = localStorage.getItem(QUESTIONING_KEY);
  if (saved && questioningModeSelect.querySelector(`option[value="${saved}"]`)) {
    questioningModeSelect.value = saved;
  }
}

function saveQuestioningMode() {
  localStorage.setItem(QUESTIONING_KEY, questioningModeSelect.value);
}

function getQuestioningMode() {
  return questioningModeSelect.value;
}

function loadDriveLink() {
  const saved = localStorage.getItem(DRIVE_LINK_KEY);
  if (saved) driveLinkInput.value = saved;
}

function saveDriveLink() {
  localStorage.setItem(DRIVE_LINK_KEY, driveLinkInput.value.trim());
}

function getReferenceLink() {
  return driveLinkInput.value.trim();
}

function setReferenceStatus(message, type = "info") {
  if (!message) {
    referenceStatus.classList.add("hidden");
    referenceStatus.textContent = "";
    referenceStatus.className = "reference-status hidden";
    return;
  }
  referenceStatus.className = `reference-status reference-status-${type}`;
  referenceStatus.textContent = message;
  referenceStatus.classList.remove("hidden");
}

function updateChatContextBadge() {
  if (lastReview && lastFilename) {
    chatContextBadge.classList.remove("hidden");
    chatContextBadge.textContent = `Using context from: ${lastFilename}`;
  } else {
    chatContextBadge.classList.add("hidden");
    chatContextBadge.textContent = "";
  }

  if (referenceLoaded && lastReferenceLink) {
    chatReferenceBadge.classList.remove("hidden");
    chatReferenceBadge.textContent = "Google Drive reference loaded";
  } else {
    chatReferenceBadge.classList.add("hidden");
    chatReferenceBadge.textContent = "";
  }

  if (journalLoaded && lastJournalFilename) {
    chatJournalBadge.classList.remove("hidden");
    chatJournalBadge.textContent = `Consultation journal: ${lastJournalFilename}`;
  } else {
    chatJournalBadge.classList.add("hidden");
    chatJournalBadge.textContent = "";
  }

  if (questionnaireLoaded && lastQuestionnaireFilename) {
    chatQuestionnaireBadge.classList.remove("hidden");
    const critiqueNote = questionnaireCritiqueEnabled ? " · critique enabled" : "";
    chatQuestionnaireBadge.textContent = `Questionnaire: ${lastQuestionnaireFilename}${critiqueNote}`;
  } else {
    chatQuestionnaireBadge.classList.add("hidden");
    chatQuestionnaireBadge.textContent = "";
  }
}

async function loadReferenceMaterial({ silent = false } = {}) {
  const link = getReferenceLink();
  if (!link) {
    lastReferenceLink = "";
    lastReferenceExcerpt = "";
    referenceLoaded = false;
    setReferenceStatus(
      "No Google Drive link — using your uploaded paper and conversation context.",
      "info"
    );
    updateChatContextBadge();
    return true;
  }

  saveDriveLink();
  loadReferenceBtn.disabled = true;
  loadReferenceBtn.textContent = "Loading…";
  if (!silent) setReferenceStatus("Fetching reference material from Google Drive…", "info");

  const formData = new FormData();
  formData.append("drive_link", link);
  appendProviderFields(formData);

  try {
    const res = await fetch("/api/reference/load", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Could not load Google Drive reference.");
    }

    lastReferenceLink = data.link || "";
    lastReferenceExcerpt = data.reference_text || data.excerpt || "";
    referenceLoaded = Boolean(lastReferenceExcerpt);

    if (referenceLoaded) {
      const truncatedNote = data.truncated ? " · truncated for length" : "";
      setReferenceStatus(
        `Reference loaded (~${data.word_count.toLocaleString()} words${truncatedNote}).`,
        "success"
      );
    } else {
      setReferenceStatus(
        data.message || "No reference content found — using your paper and conversation context.",
        "info"
      );
    }

    updateChatContextBadge();
    return true;
  } catch (err) {
    lastReferenceLink = "";
    lastReferenceExcerpt = "";
    referenceLoaded = false;
    setReferenceStatus(
      `${err.message} Continuing with your paper and conversation context.`,
      "info"
    );
    updateChatContextBadge();
    if (!silent) removeError();
    return true;
  } finally {
    loadReferenceBtn.disabled = false;
    loadReferenceBtn.textContent = "Load";
  }
}

apiKeyInput.addEventListener("change", saveApiKeys);
geminiKeyInput.addEventListener("change", saveApiKeys);
aiProviderSelect.addEventListener("change", saveApiKeys);
questioningModeSelect.addEventListener("change", saveQuestioningMode);
driveLinkInput.addEventListener("change", () => {
  saveDriveLink();
  if (!getReferenceLink()) {
    lastReferenceLink = "";
    lastReferenceExcerpt = "";
    referenceLoaded = false;
    setReferenceStatus(
      "No Google Drive link — using your uploaded paper and conversation context.",
      "info"
    );
    updateChatContextBadge();
  }
});
loadReferenceBtn.addEventListener("click", () => loadReferenceMaterial());

toggleKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleKeyBtn.textContent = isPassword ? "Hide" : "Show";
});

toggleGeminiKeyBtn.addEventListener("click", () => {
  const isPassword = geminiKeyInput.type === "password";
  geminiKeyInput.type = isPassword ? "text" : "password";
  toggleGeminiKeyBtn.textContent = isPassword ? "Hide" : "Show";
});

function updateQuestionnaireAvailability() {
  const paperReady = Boolean(selectedFile);
  questionnaireInput.disabled = !paperReady;
  questionnaireBrowseBtn.disabled = !paperReady;
  questionnaireDropZone.classList.toggle("drop-zone-disabled", !paperReady);
  questionnaireDropZone.setAttribute("aria-disabled", paperReady ? "false" : "true");
  questionnaireDropZone.setAttribute("tabindex", paperReady ? "0" : "-1");

  const subtitle = questionnaireDropZone.querySelector(".drop-sub");
  if (subtitle) {
    subtitle.textContent = paperReady
      ? "PDF, DOCX, TXT, or MD — up to 50 MB"
      : "Upload your paper first · PDF, DOCX, TXT, or MD";
  }

  if (!paperReady) {
    setQuestionnaireFile(null);
    critiqueQuestionnaireCheckbox.checked = false;
    critiqueQuestionnaireCheckbox.disabled = true;
  } else if (!selectedQuestionnaire) {
    critiqueQuestionnaireCheckbox.disabled = true;
  } else {
    critiqueQuestionnaireCheckbox.disabled = false;
  }
}

function setFile(file) {
  if (!file) {
    selectedFile = null;
    fileInfo.classList.add("hidden");
    submitBtn.disabled = true;
    updateQuestionnaireAvailability();
    return;
  }

  const allowed = [".pdf", ".docx", ".doc", ".txt", ".md"];
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowed.includes(ext)) {
    showError("Unsupported file type. Use PDF, DOCX, TXT, or MD.");
    return;
  }

  selectedFile = file;
  fileInfo.classList.remove("hidden");
  fileInfo.innerHTML = `
    <span><strong>${escapeHtml(file.name)}</strong> (${formatBytes(file.size)})</span>
    <button type="button" id="remove-file">Remove</button>
  `;
  document.getElementById("remove-file").addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.value = "";
    setFile(null);
  });
  submitBtn.disabled = false;
  updateQuestionnaireAvailability();
}

function setQuestionnaireFile(file) {
  if (!file) {
    selectedQuestionnaire = null;
    questionnaireInfo.classList.add("hidden");
    lastQuestionnaireExcerpt = "";
    lastQuestionnaireFilename = "";
    questionnaireLoaded = false;
    critiqueQuestionnaireCheckbox.checked = false;
    critiqueQuestionnaireCheckbox.disabled = true;
    updateChatContextBadge();
    return;
  }

  if (!selectedFile) {
    showError("Upload your paper before adding a questionnaire.");
    questionnaireInput.value = "";
    return;
  }

  const allowed = [".pdf", ".docx", ".doc", ".txt", ".md"];
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowed.includes(ext)) {
    showError("Unsupported questionnaire type. Use PDF, DOCX, TXT, or MD.");
    return;
  }

  selectedQuestionnaire = file;
  lastQuestionnaireFilename = file.name;
  questionnaireLoaded = true;
  critiqueQuestionnaireCheckbox.disabled = false;
  questionnaireInfo.classList.remove("hidden");
  questionnaireInfo.innerHTML = `
    <span><strong>${escapeHtml(file.name)}</strong> (${formatBytes(file.size)})</span>
    <button type="button" id="remove-questionnaire">Remove</button>
  `;
  document.getElementById("remove-questionnaire").addEventListener("click", (e) => {
    e.stopPropagation();
    questionnaireInput.value = "";
    setQuestionnaireFile(null);
  });
  updateChatContextBadge();
}

function setJournalFile(file) {
  if (!file) {
    selectedJournal = null;
    journalInfo.classList.add("hidden");
    lastJournalExcerpt = "";
    lastJournalFilename = "";
    journalLoaded = false;
    updateChatContextBadge();
    return;
  }

  const allowed = [".pdf", ".docx", ".doc", ".txt", ".md"];
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!allowed.includes(ext)) {
    showError("Unsupported journal type. Use PDF, DOCX, TXT, or MD.");
    return;
  }

  selectedJournal = file;
  lastJournalFilename = file.name;
  journalLoaded = true;
  journalInfo.classList.remove("hidden");
  journalInfo.innerHTML = `
    <span><strong>${escapeHtml(file.name)}</strong> (${formatBytes(file.size)})</span>
    <button type="button" id="remove-journal">Remove</button>
  `;
  document.getElementById("remove-journal").addEventListener("click", (e) => {
    e.stopPropagation();
    journalInput.value = "";
    setJournalFile(null);
  });
  updateChatContextBadge();
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

browseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});

journalBrowseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  journalInput.click();
});

journalDropZone.addEventListener("click", () => journalInput.click());

journalDropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    journalInput.click();
  }
});

journalInput.addEventListener("change", () => {
  if (journalInput.files[0]) setJournalFile(journalInput.files[0]);
});

journalDropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  journalDropZone.classList.add("dragover");
});

journalDropZone.addEventListener("dragleave", () => journalDropZone.classList.remove("dragover"));

journalDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  journalDropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) setJournalFile(file);
});

questionnaireBrowseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (selectedFile) questionnaireInput.click();
});

questionnaireDropZone.addEventListener("click", () => {
  if (selectedFile) questionnaireInput.click();
});

questionnaireDropZone.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && selectedFile) {
    e.preventDefault();
    questionnaireInput.click();
  }
});

questionnaireInput.addEventListener("change", () => {
  if (questionnaireInput.files[0]) setQuestionnaireFile(questionnaireInput.files[0]);
});

questionnaireDropZone.addEventListener("dragover", (e) => {
  if (!selectedFile) return;
  e.preventDefault();
  questionnaireDropZone.classList.add("dragover");
});

questionnaireDropZone.addEventListener("dragleave", () => questionnaireDropZone.classList.remove("dragover"));

questionnaireDropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  questionnaireDropZone.classList.remove("dragover");
  if (!selectedFile) {
    showError("Upload your paper before adding a questionnaire.");
    return;
  }
  const file = e.dataTransfer.files[0];
  if (file) setQuestionnaireFile(file);
});

critiqueQuestionnaireCheckbox.addEventListener("change", () => {
  questionnaireCritiqueEnabled = critiqueQuestionnaireCheckbox.checked;
  updateChatContextBadge();
});

function showError(message) {
  removeError();
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.id = "error-banner";
  banner.textContent = message;
  reviewContent.parentElement.insertBefore(banner, reviewContent);
}

function removeError() {
  document.getElementById("error-banner")?.remove();
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading || !selectedFile;
  submitBtn.querySelector(".btn-label").classList.toggle("hidden", isLoading);
  submitBtn.querySelector(".btn-spinner").classList.toggle("hidden", !isLoading);

  emptyState.classList.toggle("hidden", isLoading || lastReview);
  loadingState.classList.toggle("hidden", !isLoading);
  reviewContent.classList.toggle("hidden", isLoading || !lastReview);
}

function renderMarkdown(text) {
  return marked.parse(text, { breaks: true });
}

function hideChatWelcome() {
  chatMessages.querySelector(".chat-welcome")?.remove();
}

function scrollChatToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendChatBubble(role, content, { isTyping = false } = {}) {
  hideChatWelcome();

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble chat-bubble-${role}${isTyping ? " chat-bubble-typing" : ""}`;

  const label = document.createElement("div");
  label.className = "chat-bubble-label";
  label.textContent = role === "user" ? "You" : "Professor Meridian";

  const body = document.createElement("div");
  body.className = "chat-bubble-body";
  if (isTyping) {
    body.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
  } else if (role === "assistant") {
    body.innerHTML = renderMarkdown(content);
  } else {
    body.textContent = content;
  }

  bubble.append(label, body);
  chatMessages.appendChild(bubble);
  scrollChatToBottom();
  return bubble;
}

function setChatSending(isSending) {
  chatSending = isSending;
  chatSendBtn.disabled = isSending;
  chatInput.disabled = isSending;
  chatSendBtn.querySelector(".btn-label").classList.toggle("hidden", isSending);
  chatSendBtn.querySelector(".btn-spinner").classList.toggle("hidden", !isSending);
}

async function sendChatMessage(text) {
  const message = text.trim();
  if (!message || chatSending) return;

  if (!validateApiKeys()) return;

  chatInput.value = "";
  appendChatBubble("user", message);
  chatHistory.push({ role: "user", content: message });

  const typingBubble = appendChatBubble("assistant", "", { isTyping: true });
  setChatSending(true);
  removeError();

  const formData = new FormData();
  formData.append("message", message);
  formData.append("history", JSON.stringify(chatHistory.slice(0, -1)));
  formData.append("previous_review", lastReview);
  formData.append("paper_excerpt", lastPaperExcerpt);
  formData.append("filename", lastFilename);
  formData.append("questioning_mode", getQuestioningMode());
  formData.append("reference_link", lastReferenceLink || getReferenceLink());
  formData.append("reference_excerpt", lastReferenceExcerpt);
  formData.append("journal_excerpt", lastJournalExcerpt);
  formData.append("journal_filename", lastJournalFilename);
  formData.append("questionnaire_excerpt", lastQuestionnaireExcerpt);
  formData.append("questionnaire_filename", lastQuestionnaireFilename);
  formData.append("questionnaire_critique", questionnaireCritiqueEnabled ? "true" : "false");
  appendProviderFields(formData);

  try {
    const res = await fetch("/api/chat", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Chat request failed.");
    }

    typingBubble.remove();
    appendChatBubble("assistant", data.response);
    chatHistory.push({ role: "assistant", content: data.response });
    if (data.provider) lastProvider = data.provider;
  } catch (err) {
    typingBubble.remove();
    chatHistory.pop();
    showError(err.message);
  } finally {
    setChatSending(false);
    chatInput.focus();
  }
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendChatMessage(chatInput.value);
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage(chatInput.value);
  }
});

document.querySelectorAll(".chat-suggestion").forEach((btn) => {
  btn.addEventListener("click", () => {
    const prompt = btn.dataset.prompt;
    if (prompt) sendChatMessage(prompt);
  });
});

clearChatBtn.addEventListener("click", () => {
  chatHistory = [];
  chatMessages.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon" aria-hidden="true">💬</div>
      <p><strong>Office hours are open.</strong></p>
      <p class="chat-welcome-sub">Ask about thesis structure, methodology, citations, or how to revise a section. After you upload a paper, I can reference your review and document. Use <strong>Advisor questioning</strong> on the left to control how much the professor challenges you.</p>
      <div class="chat-suggestions">
        <button type="button" class="chat-suggestion" data-prompt="How do I write a strong thesis statement?">Strong thesis statement</button>
        <button type="button" class="chat-suggestion" data-prompt="What's the difference between a literature review and a background section?">Lit review vs background</button>
        <button type="button" class="chat-suggestion" data-prompt="How should I structure my methodology section?">Methodology structure</button>
      </div>
    </div>
  `;
  document.querySelectorAll(".chat-suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.prompt;
      if (prompt) sendChatMessage(prompt);
    });
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  removeError();

  if (!selectedFile) {
    showError("Please select a file to review.");
    return;
  }

  if (!validateApiKeys()) return;

  if (critiqueQuestionnaireCheckbox.checked && !selectedQuestionnaire) {
    showError("Upload a questionnaire file to enable questionnaire critique.");
    return;
  }

  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("paper_type", document.getElementById("paper-type").value);
  formData.append("review_depth", document.getElementById("review-depth").value);
  formData.append("focus_areas", document.getElementById("focus-areas").value);
  formData.append("questioning_mode", getQuestioningMode());
  formData.append("reference_link", getReferenceLink());
  formData.append("reference_excerpt", lastReferenceExcerpt);
  formData.append("journal_excerpt", lastJournalExcerpt);
  formData.append("journal_filename", lastJournalFilename);
  if (selectedJournal) {
    formData.append("journal_file", selectedJournal);
  }
  formData.append("questionnaire_excerpt", lastQuestionnaireExcerpt);
  formData.append("questionnaire_filename", lastQuestionnaireFilename);
  formData.append("critique_questionnaire", critiqueQuestionnaireCheckbox.checked ? "true" : "false");
  if (selectedQuestionnaire) {
    formData.append("questionnaire_file", selectedQuestionnaire);
  }
  appendProviderFields(formData);

  setLoading(true);

  try {
    if (getReferenceLink()) {
      await loadReferenceMaterial({ silent: true });
      formData.set("reference_excerpt", lastReferenceExcerpt);
      formData.set("reference_link", lastReferenceLink || getReferenceLink());
    } else {
      formData.set("reference_link", "");
      formData.set("reference_excerpt", "");
    }

    const res = await fetch("/api/review", { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Review failed.");
    }

    lastReview = data.review;
    lastFilename = data.filename;
    lastPaperExcerpt = data.paper_excerpt || "";
    lastProvider = data.provider || lastProvider;

    if (data.journal_loaded) {
      lastJournalExcerpt = data.journal_excerpt || lastJournalExcerpt;
      lastJournalFilename = data.journal_filename || lastJournalFilename;
      journalLoaded = true;
    }

    if (data.questionnaire_loaded) {
      lastQuestionnaireExcerpt = data.questionnaire_excerpt || lastQuestionnaireExcerpt;
      lastQuestionnaireFilename = data.questionnaire_filename || lastQuestionnaireFilename;
      questionnaireLoaded = true;
      questionnaireCritiqueEnabled = Boolean(data.questionnaire_critique);
      critiqueQuestionnaireCheckbox.checked = questionnaireCritiqueEnabled;
      critiqueQuestionnaireCheckbox.disabled = false;
    }

    if (data.reference_loaded) {
      lastReferenceLink = getReferenceLink();
      lastReferenceExcerpt = data.reference_excerpt || lastReferenceExcerpt;
      referenceLoaded = true;
      const truncatedNote = data.reference_truncated ? " · truncated for length" : "";
      setReferenceStatus(
        `Reference loaded (~${(data.reference_word_count || 0).toLocaleString()} words${truncatedNote}).`,
        "success"
      );
    } else if (getReferenceLink() && data.reference_message) {
      lastReferenceLink = "";
      lastReferenceExcerpt = "";
      referenceLoaded = false;
      setReferenceStatus(
        `${data.reference_message} Using your paper and conversation context.`,
        "info"
      );
    } else if (!getReferenceLink()) {
      referenceLoaded = false;
      setReferenceStatus(
        "No Google Drive link — using your uploaded paper and conversation context.",
        "info"
      );
    }

    reviewContent.innerHTML = renderMarkdown(data.review);
    metaInfo.classList.remove("hidden");
    const providerLabel = data.provider ? `${data.provider} · ` : "";
    metaInfo.textContent = `${data.filename} · ~${data.word_count.toLocaleString()} words · ${providerLabel}${data.model}${data.truncated ? ` · excerpt only (${(data.paper_chars_sent || 0).toLocaleString()} chars sent)` : ""}`;

    updateChatContextBadge();
  } catch (err) {
    showError(err.message);
    reviewContent.classList.add("hidden");
    emptyState.classList.remove("hidden");
  } finally {
    setLoading(false);
  }
});

loadApiKey();
loadQuestioningMode();
loadDriveLink();
updateQuestionnaireAvailability();
updateChatContextBadge();
