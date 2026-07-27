import { StatusBar } from "expo-status-bar";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  claimPoints,
  finishConversation,
  getDashboard,
  sendMessage,
  startConversation,
  type Conversation,
  type DashboardSummary,
  type Feedback,
  type ScenarioId,
} from "./src/api";

const scenarios: Array<{
  id: ScenarioId;
  emoji: string;
  title: string;
  subtitle: string;
  level: string;
}> = [
  {
    id: "cafe",
    emoji: "☕",
    title: "At the café",
    subtitle: "สั่งเครื่องดื่มและพูดคุยกับบาริสต้า",
    level: "Beginner",
  },
  {
    id: "travel",
    emoji: "✈️",
    title: "Airport check-in",
    subtitle: "เช็กอิน ตอบคำถาม และจัดการสัมภาระ",
    level: "Intermediate",
  },
  {
    id: "interview",
    emoji: "💼",
    title: "Job interview",
    subtitle: "แนะนำตัวและเล่าประสบการณ์ทำงาน",
    level: "Intermediate",
  },
];

type Screen = "home" | "chat" | "feedback" | "flashcards";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary>({
    completedToday: 0,
    completedScenarios: [],
    totalScenarios: scenarios.length,
    remainingToday: scenarios.length,
    progressPercent: 0,
    points: 0,
    canClaimPoints: false,
  });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      setDraft(transcript);
    }
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    if (event.error !== "aborted") {
      setError(`ไม่สามารถรับเสียงได้: ${event.message || event.error}`);
    }
  });

  useEffect(() => {
    if (screen === "chat") {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [conversation?.messages.length, screen]);

  useEffect(() => {
    if (screen !== "home") return;

    let active = true;
    getDashboard()
      .then((summary) => {
        if (active) {
          setDashboard(summary);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : "โหลดแดชบอร์ดไม่สำเร็จ");
        }
      });

    return () => {
      active = false;
    };
  }, [screen]);

  async function begin(scenario: ScenarioId) {
    setLoading(true);
    setError("");
    try {
      const session = await startConversation(scenario);
      setConversation(session.conversation);

      if (session.mode === "feedback") {
        setFeedback(session.feedback);
        setScreen("feedback");
        return;
      }

      setFeedback(null);
      setScreen("chat");
      const lastAssistantMessage = [...session.conversation.messages]
        .reverse()
        .find((message) => message.role === "assistant");
      Speech.speak(lastAssistantMessage?.content || "", {
        language: "en-US",
        rate: 0.9,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "เริ่มบทสนทนาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    const text = draft.trim();
    if (!conversation || !text || loading) return;

    setDraft("");
    setLoading(true);
    setError("");
    const optimistic = {
      id: `local-${Date.now()}`,
      role: "user" as const,
      content: text,
      createdAt: new Date().toISOString(),
    };
    setConversation({ ...conversation, messages: [...conversation.messages, optimistic] });

    try {
      const result = await sendMessage(conversation.id, text);
      setConversation((current) =>
        current
          ? {
              ...current,
              messages: [
                ...current.messages.filter((message) => message.id !== optimistic.id),
                result.userMessage,
                result.assistantMessage,
              ],
            }
          : current,
      );
      Speech.speak(result.assistantMessage.content, {
        language: "en-US",
        rate: 0.9,
      });
    } catch (caught) {
      setConversation(conversation);
      setDraft(text);
      setError(caught instanceof Error ? caught.message : "ส่งข้อความไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function toggleVoiceInput() {
    setError("");

    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    Speech.stop();
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError("กรุณาอนุญาตการใช้ไมโครโฟนและ Speech Recognition ใน Settings");
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
      requiresOnDeviceRecognition: false,
    });
  }

  async function finish() {
    if (!conversation || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await finishConversation(conversation.id);
      Speech.stop();
      setFeedback(result);
      setScreen("feedback");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "สร้างผลสรุปไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    Speech.stop();
    setConversation(null);
    setFeedback(null);
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setDraft("");
    setError("");
    setScreen("home");
  }

  function startFlashcards() {
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setScreen("flashcards");
  }

  function nextFlashcard() {
    if (!feedback) return;
    if (!flashcardFlipped) {
      setFlashcardFlipped(true);
      return;
    }
    if (flashcardIndex < feedback.flashcards.length - 1) {
      setFlashcardIndex((current) => current + 1);
      setFlashcardFlipped(false);
    }
  }

  function previousFlashcard() {
    if (!feedback) return;
    if (flashcardFlipped) {
      setFlashcardFlipped(false);
      return;
    }
    if (flashcardIndex > 0) {
      setFlashcardIndex((current) => current - 1);
      setFlashcardFlipped(true);
    }
  }

  async function getPoints() {
    if (!dashboard.canClaimPoints || loading) return;
    setLoading(true);
    setError("");
    try {
      setDashboard(await claimPoints());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "รับแต้มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {screen === "home" && (
        <ScrollView contentContainerStyle={styles.home}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>J</Text>
            </View>
            <Text style={styles.brand}>JUMP English</Text>
            <View style={styles.pointsPill}>
              <Text style={styles.pointsText}>⭐ {dashboard.points} Points</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.eyebrow}>DAILY DASHBOARD</Text>
            <View style={styles.dashboardMain}>
              <View>
                <Text style={styles.dashboardNumber}>
                  {dashboard.completedToday}
                  <Text style={styles.dashboardTotal}>/{dashboard.totalScenarios}</Text>
                </Text>
                <Text style={styles.dashboardLabel}>หัวข้อที่ทำเสร็จวันนี้</Text>
              </View>
              <View style={styles.dashboardRemaining}>
                <Text style={styles.remainingNumber}>{dashboard.remainingToday}</Text>
                <Text style={styles.remainingLabel}>หัวข้อที่เหลือ</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${dashboard.progressPercent}%` },
                ]}
              />
            </View>
            <View style={styles.dashboardFooter}>
              <Text style={styles.progressText}>ความคืบหน้าประจำวัน</Text>
              <Text style={styles.progressPercent}>{dashboard.progressPercent}%</Text>
            </View>
            {dashboard.canClaimPoints && (
              <Pressable
                style={[styles.claimButton, loading && styles.disabled]}
                onPress={getPoints}
                disabled={loading}
              >
                <Text style={styles.claimButtonText}>
                  {loading ? "กำลังรับแต้ม…" : "Get 10 Points"}
                </Text>
              </Pressable>
            )}
          </View>

          {dashboard.remainingToday > 0 && (
            <>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>เลือกสถานการณ์</Text>
                <Text style={styles.sectionMeta}>ประมาณ 5 นาที</Text>
              </View>

              {scenarios
                .filter(
                  (scenario) =>
                    !dashboard.completedScenarios.includes(scenario.id),
                )
                .map((scenario) => (
                  <Pressable
                    key={scenario.id}
                    style={({ pressed }) => [
                      styles.scenarioCard,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => begin(scenario.id)}
                    disabled={loading}
                  >
                    <View style={styles.scenarioIcon}>
                      <Text style={styles.scenarioEmoji}>{scenario.emoji}</Text>
                    </View>
                    <View style={styles.scenarioBody}>
                      <View style={styles.scenarioTop}>
                        <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                        <Text style={styles.chevron}>›</Text>
                      </View>
                      <Text style={styles.scenarioSubtitle}>
                        {scenario.subtitle}
                      </Text>
                      <View style={styles.levelPill}>
                        <Text style={styles.levelText}>{scenario.level}</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
            </>
          )}

          {dashboard.completedScenarios.length > 0 && (
            <>
              <View style={styles.flashcardSectionHeader}>
                <Text style={styles.sectionTitle}>Flashcard</Text>
                <Text style={styles.sectionMeta}>
                  {dashboard.completedScenarios.length} สถานการณ์
                </Text>
              </View>
              {scenarios
                .filter((scenario) =>
                  dashboard.completedScenarios.includes(scenario.id),
                )
                .map((scenario) => (
                  <Pressable
                    key={scenario.id}
                    style={({ pressed }) => [
                      styles.scenarioCard,
                      styles.flashcardScenarioCard,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => begin(scenario.id)}
                    disabled={loading}
                  >
                    <View style={styles.scenarioIcon}>
                      <Text style={styles.scenarioEmoji}>{scenario.emoji}</Text>
                    </View>
                    <View style={styles.scenarioBody}>
                      <View style={styles.scenarioTop}>
                        <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                        <Text style={styles.chevron}>›</Text>
                      </View>
                      <Text style={styles.scenarioSubtitle}>
                        ทบทวน Feedback และ Flashcards
                      </Text>
                      <View style={styles.completedPill}>
                        <Text style={styles.completedText}>✓ เสร็จแล้ว</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}
            </>
          )}

          {loading && <ActivityIndicator color="#16A34A" style={styles.loader} />}
          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
      )}

      {screen === "chat" && conversation && (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.chatHeader}>
            <Pressable onPress={reset} hitSlop={12}>
              <Text style={styles.back}>‹</Text>
            </Pressable>
            <View>
              <Text style={styles.chatTitle}>
                {scenarios.find((item) => item.id === conversation.scenario)?.title}
              </Text>
              <Text style={styles.online}>● AI tutor is ready</Text>
            </View>
            <Pressable style={styles.finishButton} onPress={finish} disabled={loading}>
              <Text style={styles.finishText}>Finish</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            <View style={styles.coachNote}>
              <Text style={styles.coachNoteText}>
                💡 ตอบเป็นภาษาอังกฤษได้เลย ไม่ต้องกลัวผิด
              </Text>
            </View>
            {conversation.messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  message.role === "user" && styles.userMessageRow,
                ]}
              >
                {message.role === "assistant" && (
                  <View style={styles.avatar}>
                    <Text>✨</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.bubble,
                    message.role === "user" ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      message.role === "user" && styles.userMessageText,
                    ]}
                  >
                    {message.content}
                  </Text>
                  {message.role === "assistant" && (
                    <Pressable
                      style={styles.listen}
                      onPress={() =>
                        Speech.speak(message.content, { language: "en-US", rate: 0.9 })
                      }
                    >
                      <Text style={styles.listenText}>🔊 Listen again</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
            {loading && (
              <View style={styles.typing}>
                <ActivityIndicator size="small" color="#16A34A" />
                <Text style={styles.typingText}>AI is thinking…</Text>
              </View>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type your answer in English…"
              placeholderTextColor="#98A2B3"
              multiline
              maxLength={500}
              editable={!loading}
              onSubmitEditing={submit}
            />
            <Pressable
              style={[styles.micButton, listening && styles.micButtonActive]}
              onPress={toggleVoiceInput}
              disabled={loading}
            >
              <Text style={styles.micText}>{listening ? "■" : "🎤"}</Text>
            </Pressable>
            <Pressable
              style={[styles.sendButton, (!draft.trim() || loading) && styles.disabled]}
              onPress={submit}
              disabled={!draft.trim() || loading}
            >
              <Text style={styles.sendText}>↑</Text>
            </Pressable>
          </View>
          <Text style={[styles.voiceHint, listening && styles.listeningHint]}>
            {listening
              ? "กำลังฟัง… พูดภาษาอังกฤษ แล้วกด ■ เพื่อหยุด"
              : "แตะ 🎤 เพื่อพูด · ระบบจะนำข้อความมาใส่ในช่องตอบ"}
          </Text>
        </KeyboardAvoidingView>
      )}

      {screen === "feedback" && feedback && (
        <ScrollView contentContainerStyle={styles.feedbackPage}>
          <Text style={styles.feedbackEyebrow}>SESSION COMPLETE</Text>
          <Text style={styles.feedbackTitle}>เยี่ยมมาก! 🎉</Text>
          <Text style={styles.feedbackSubtitle}>นี่คือผลการฝึกของคุณในรอบนี้</Text>

          <View style={styles.scoreCard}>
            {(
              [
                ["Grammar", feedback.scores.grammar],
                ["Vocabulary", feedback.scores.vocabulary],
                ["Communication", feedback.scores.communication],
              ] as const
            ).map(([label, score]) => (
              <View style={styles.scoreItem} key={label}>
                <Text style={styles.score}>{score}</Text>
                <Text style={styles.scoreLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.insightCard}>
            <Text style={styles.cardLabel}>COACH FEEDBACK</Text>
            <Text style={styles.summary}>{feedback.summary}</Text>
          </View>

          {feedback.corrections.length > 0 && (
            <>
              <Text style={styles.feedbackSectionTitle}>ประโยคที่พัฒนาได้</Text>
              {feedback.corrections.map((correction, index) => (
                <View style={styles.correctionCard} key={`${correction.original}-${index}`}>
                  <Text style={styles.original}>✕ {correction.original}</Text>
                  <Text style={styles.improved}>✓ {correction.improved}</Text>
                  <Text style={styles.explanation}>{correction.explanationTh}</Text>
                </View>
              ))}
            </>
          )}

          {feedback.flashcards.length > 0 && (
            <Pressable style={styles.flashcardButton} onPress={startFlashcards}>
              <View>
                <Text style={styles.flashcardButtonTitle}>ทบทวน Flashcards</Text>
                <Text style={styles.flashcardButtonSubtitle}>
                  {feedback.flashcards.length} คำศัพท์จากบทเรียนนี้
                </Text>
              </View>
              <Text style={styles.flashcardButtonArrow}>›</Text>
            </Pressable>
          )}

          <Pressable style={styles.primaryButton} onPress={reset}>
            <Text style={styles.primaryButtonText}>ฝึกอีกสถานการณ์</Text>
          </Pressable>
        </ScrollView>
      )}

      {screen === "flashcards" && feedback && feedback.flashcards.length > 0 && (
        <View style={styles.flashcardPage}>
          <View style={styles.flashcardPageHeader}>
            <Pressable onPress={() => setScreen("feedback")} hitSlop={12}>
              <Text style={styles.back}>‹</Text>
            </Pressable>
            <Text style={styles.flashcardPageTitle}>Flashcards</Text>
            <Pressable onPress={reset}>
              <Text style={styles.flashcardDone}>Home</Text>
            </Pressable>
          </View>

          <Text style={styles.flashcardCounter}>
            {flashcardIndex + 1} / {feedback.flashcards.length}
          </Text>
          <View style={styles.flashcardProgress}>
            <View
              style={[
                styles.flashcardProgressFill,
                {
                  width: `${((flashcardIndex + (flashcardFlipped ? 1 : 0.5)) /
                    feedback.flashcards.length) *
                    100}%`,
                },
              ]}
            />
          </View>

          <Pressable
            style={[
              styles.studyCard,
              flashcardFlipped && styles.studyCardFlipped,
            ]}
            onPress={nextFlashcard}
          >
            <Text style={styles.studyCardSide}>
              {flashcardFlipped ? "คำแปล" : "คำศัพท์"}
            </Text>
            {flashcardFlipped ? (
              <>
                <Text style={styles.studyMeaning}>
                  {feedback.flashcards[flashcardIndex]?.meaningTh}
                </Text>
                <Text style={styles.studyExample}>
                  {feedback.flashcards[flashcardIndex]?.example}
                </Text>
              </>
            ) : (
              <Text style={styles.studyWord}>
                {feedback.flashcards[flashcardIndex]?.word}
              </Text>
            )}
            <Text style={styles.studyHint}>
              {flashcardFlipped ? "กดลูกศรขวาเพื่อไปคำถัดไป" : "กดลูกศรขวาเพื่อดูคำแปล"}
            </Text>
          </Pressable>

          <View style={styles.flashcardControls}>
            <Pressable
              style={[
                styles.arrowButton,
                flashcardIndex === 0 && !flashcardFlipped && styles.disabled,
              ]}
              onPress={previousFlashcard}
              disabled={flashcardIndex === 0 && !flashcardFlipped}
            >
              <Text style={styles.arrowButtonText}>←</Text>
            </Pressable>
            <Pressable
              style={[
                styles.arrowButton,
                styles.arrowButtonPrimary,
                flashcardIndex === feedback.flashcards.length - 1 &&
                  flashcardFlipped &&
                  styles.disabled,
              ]}
              onPress={nextFlashcard}
              disabled={
                flashcardIndex === feedback.flashcards.length - 1 &&
                flashcardFlipped
              }
            >
              <Text style={styles.arrowButtonPrimaryText}>→</Text>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4FBF6" },
  flex: { flex: 1 },
  home: { padding: 22, paddingBottom: 48 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  brand: { color: "#101828", fontSize: 19, fontWeight: "800", marginLeft: 10, flex: 1 },
  pointsPill: { backgroundColor: "#DCFCE7", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#86EFAC" },
  pointsText: { color: "#15803D", fontSize: 12, fontWeight: "900" },
  hero: { backgroundColor: "#14532D", borderRadius: 28, padding: 24, marginBottom: 28 },
  eyebrow: { color: "#86EFAC", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  dashboardMain: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 15 },
  dashboardNumber: { color: "#FFFFFF", fontSize: 48, lineHeight: 54, fontWeight: "900" },
  dashboardTotal: { color: "#98A2B3", fontSize: 25, fontWeight: "700" },
  dashboardLabel: { color: "#CCD1DC", fontSize: 13, marginTop: 3 },
  dashboardRemaining: { alignItems: "center", backgroundColor: "#166534", borderRadius: 18, paddingHorizontal: 17, paddingVertical: 12 },
  remainingNumber: { color: "#86EFAC", fontSize: 24, fontWeight: "900" },
  remainingLabel: { color: "#BBF7D0", fontSize: 10, marginTop: 2 },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: "#166534", marginTop: 22 },
  progressFill: { height: 7, borderRadius: 4, backgroundColor: "#4ADE80" },
  dashboardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  progressText: { color: "#98A2B3", fontSize: 12 },
  progressPercent: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  claimButton: { backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  claimButtonText: { color: "#15803D", fontSize: 14, fontWeight: "900" },
  sectionTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 13 },
  sectionTitle: { color: "#0B1F14", fontSize: 20, fontWeight: "900" },
  sectionMeta: { color: "#667085", fontSize: 12 },
  scenarioCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#EAECF0",
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  scenarioIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  scenarioEmoji: { fontSize: 27 },
  scenarioBody: { flex: 1, marginLeft: 14 },
  scenarioTop: { flexDirection: "row", justifyContent: "space-between" },
  scenarioTitle: { color: "#101828", fontSize: 17, fontWeight: "800" },
  chevron: { color: "#667085", fontSize: 25, lineHeight: 20 },
  scenarioSubtitle: { color: "#667085", fontSize: 13, lineHeight: 19, marginTop: 4 },
  levelPill: { alignSelf: "flex-start", backgroundColor: "#ECFDF3", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginTop: 9 },
  levelText: { color: "#027A48", fontSize: 10, fontWeight: "700" },
  flashcardSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 13 },
  flashcardScenarioCard: { borderColor: "#B7E4C7", backgroundColor: "#F7FFF9" },
  completedPill: { alignSelf: "flex-start", backgroundColor: "#ECFDF3", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginTop: 9 },
  completedText: { color: "#027A48", fontSize: 10, fontWeight: "700" },
  loader: { marginTop: 14 },
  error: { color: "#D92D20", textAlign: "center", marginVertical: 10 },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0",
    backgroundColor: "#FFFFFF",
  },
  back: { fontSize: 38, color: "#101828", lineHeight: 38, width: 36 },
  chatTitle: { color: "#101828", fontWeight: "800", fontSize: 16 },
  online: { color: "#12B76A", fontSize: 11, marginTop: 2 },
  finishButton: { marginLeft: "auto", backgroundColor: "#DCFCE7", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
  finishText: { color: "#15803D", fontWeight: "800" },
  messages: { flex: 1 },
  messagesContent: { padding: 18, paddingBottom: 28 },
  coachNote: { alignSelf: "center", backgroundColor: "#FFF7E8", borderRadius: 14, paddingHorizontal: 13, paddingVertical: 8, marginBottom: 20 },
  coachNoteText: { color: "#7A4D00", fontSize: 12 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 16 },
  userMessageRow: { justifyContent: "flex-end" },
  avatar: { width: 31, height: 31, borderRadius: 11, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", marginRight: 8 },
  bubble: { maxWidth: "79%", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12 },
  aiBubble: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 6, borderWidth: 1, borderColor: "#EAECF0" },
  userBubble: { backgroundColor: "#16A34A", borderBottomRightRadius: 6 },
  messageText: { color: "#1D2939", fontSize: 15, lineHeight: 22 },
  userMessageText: { color: "#FFFFFF" },
  listen: { marginTop: 8, alignSelf: "flex-start" },
  listenText: { color: "#15803D", fontSize: 11, fontWeight: "700" },
  typing: { flexDirection: "row", alignItems: "center", marginLeft: 40, gap: 7 },
  typingText: { color: "#667085", fontSize: 12 },
  composer: { flexDirection: "row", alignItems: "flex-end", backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EAECF0" },
  input: { flex: 1, minHeight: 47, maxHeight: 110, backgroundColor: "#F6F7FB", borderRadius: 18, paddingHorizontal: 15, paddingVertical: 13, color: "#101828", fontSize: 14 },
  sendButton: { width: 45, height: 45, borderRadius: 16, backgroundColor: "#16A34A", alignItems: "center", justifyContent: "center", marginLeft: 9 },
  sendText: { color: "#FFFFFF", fontSize: 25, fontWeight: "700", marginTop: -2 },
  micButton: { width: 45, height: 45, borderRadius: 16, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", marginLeft: 9 },
  micButtonActive: { backgroundColor: "#FEE4E2", borderWidth: 1, borderColor: "#FDA29B" },
  micText: { fontSize: 19, color: "#D92D20", fontWeight: "800" },
  disabled: { opacity: 0.4 },
  voiceHint: { backgroundColor: "#FFFFFF", textAlign: "center", color: "#98A2B3", fontSize: 10, paddingTop: 6, paddingBottom: 9 },
  listeningHint: { color: "#D92D20", fontWeight: "700" },
  feedbackPage: { padding: 22, paddingBottom: 48 },
  feedbackEyebrow: { textAlign: "center", color: "#16A34A", fontSize: 11, fontWeight: "900", letterSpacing: 1.4, marginTop: 10 },
  feedbackTitle: { textAlign: "center", color: "#101828", fontSize: 32, fontWeight: "900", marginTop: 8 },
  feedbackSubtitle: { textAlign: "center", color: "#667085", marginTop: 5, marginBottom: 22 },
  scoreCard: { flexDirection: "row", backgroundColor: "#14532D", borderRadius: 24, paddingVertical: 22, marginBottom: 16 },
  scoreItem: { flex: 1, alignItems: "center", borderRightWidth: 1, borderRightColor: "#166534" },
  score: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  scoreLabel: { color: "#98A2B3", fontSize: 10, marginTop: 3 },
  insightCard: { backgroundColor: "#DCFCE7", borderRadius: 20, padding: 19, marginBottom: 24 },
  cardLabel: { color: "#15803D", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  summary: { color: "#344054", fontSize: 14, lineHeight: 22, marginTop: 8 },
  feedbackSectionTitle: { color: "#101828", fontSize: 18, fontWeight: "800", marginBottom: 11, marginTop: 6 },
  correctionCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 17, marginBottom: 20, borderWidth: 1, borderColor: "#EAECF0" },
  original: { color: "#D92D20", fontSize: 14, textDecorationLine: "line-through" },
  improved: { color: "#039855", fontSize: 15, fontWeight: "700", marginTop: 8 },
  explanation: { color: "#667085", fontSize: 12, lineHeight: 18, marginTop: 9 },
  flashcardButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#166534", borderRadius: 20, padding: 19, marginTop: 4 },
  flashcardButtonTitle: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  flashcardButtonSubtitle: { color: "#BBF7D0", fontSize: 12, marginTop: 5 },
  flashcardButtonArrow: { color: "#FFFFFF", fontSize: 32, fontWeight: "600" },
  flashcardPage: { flex: 1, paddingHorizontal: 22, paddingBottom: 36 },
  flashcardPageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12 },
  flashcardPageTitle: { color: "#101828", fontSize: 18, fontWeight: "900" },
  flashcardDone: { color: "#16A34A", fontSize: 15, fontWeight: "800" },
  flashcardCounter: { color: "#667085", fontSize: 13, textAlign: "center", marginTop: 34 },
  flashcardProgress: { height: 7, borderRadius: 5, backgroundColor: "#E4E7EC", marginTop: 10, overflow: "hidden" },
  flashcardProgressFill: { height: "100%", borderRadius: 5, backgroundColor: "#16A34A" },
  studyCard: { flex: 1, maxHeight: 430, minHeight: 330, backgroundColor: "#16A34A", borderRadius: 30, marginTop: 32, padding: 28, alignItems: "center", justifyContent: "center" },
  studyCardFlipped: { backgroundColor: "#22C55E" },
  studyCardSide: { position: "absolute", top: 25, color: "#BBF7D0", fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  studyWord: { color: "#FFFFFF", fontSize: 38, fontWeight: "900", textAlign: "center" },
  studyMeaning: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", textAlign: "center" },
  studyExample: { color: "#F0FDF4", fontSize: 16, lineHeight: 24, fontStyle: "italic", textAlign: "center", marginTop: 22 },
  studyHint: { position: "absolute", bottom: 25, color: "#D0D5DD", fontSize: 11 },
  flashcardControls: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 28 },
  arrowButton: { width: 66, height: 58, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D0D5DD", alignItems: "center", justifyContent: "center" },
  arrowButtonPrimary: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  arrowButtonText: { color: "#101828", fontSize: 27, fontWeight: "800" },
  arrowButtonPrimaryText: { color: "#FFFFFF", fontSize: 27, fontWeight: "800" },
  primaryButton: { backgroundColor: "#16A34A", borderRadius: 17, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
});
