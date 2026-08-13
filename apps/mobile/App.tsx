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
  {
    id: "dinner",
    emoji: "🍽️",
    title: "Ordering Dinner",
    subtitle: "สั่งอาหารและสอบถามเมนูในร้านอาหาร",
    level: "Beginner",
  },
  {
    id: "meeting",
    emoji: "👥",
    title: "Project Meeting",
    subtitle: "อัปเดตงานและแลกเปลี่ยนความคิดเห็นในทีม",
    level: "Advanced",
  },
  {
    id: "directions",
    emoji: "🗺️",
    title: "Asking Directions",
    subtitle: "ถามทางและทำความเข้าใจเส้นทาง",
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
    totalScenarios: 3,
    remainingToday: 3,
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
              <Text style={styles.logoText}>◇</Text>
            </View>
            <Text style={styles.brand}>JUMP English</Text>
            <View style={styles.pointsPill}>
              <Text style={styles.pointsText}>♙ {dashboard.points} pts</Text>
            </View>
          </View>

          <View style={styles.welcome}>
            <Text style={styles.welcomeTitle}>Hello, Alex!</Text>
            <Text style={styles.welcomeText}>
              You're making great progress. Ready to jump in?
            </Text>
          </View>

          <View style={styles.hero}>
            <Text style={styles.dailyGoalTitle}>Daily Goal</Text>
            <View style={styles.goalRing}>
              <View style={styles.goalRingInner}>
                <Text style={styles.goalFraction}>
                  {dashboard.completedToday}/{dashboard.totalScenarios}
                </Text>
                <Text style={styles.goalTopics}>Topics</Text>
              </View>
            </View>
            <Text style={styles.goalMessage}>
              {dashboard.remainingToday} more topics to hit your daily streak!
            </Text>
            <Pressable
              style={[styles.continueButton, loading && styles.disabled]}
              onPress={() => begin("cafe")}
              disabled={loading}
            >
              <Text style={styles.continueButtonText}>Continue Learning</Text>
            </Pressable>
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

          <View style={styles.streakCard}>
            <View style={styles.streakHeader}>
              <Text style={styles.streakLabel}>WEEKLY STREAK</Text>
              <Text style={styles.streakCount}>♨ 12 Days</Text>
            </View>
            <View style={styles.streakDays}>
              {["Mon", "Tue", "Today", "Thu"].map((day, index) => (
                <View style={styles.streakDay} key={day}>
                  <View
                    style={[
                      styles.dayDot,
                      index < 2 && styles.dayDotDone,
                      index === 2 && styles.dayDotToday,
                    ]}
                  >
                    <Text style={index < 2 ? styles.dayCheck : styles.dayText}>
                      {index < 2
                        ? "✓"
                        : index === 2
                          ? `${dashboard.completedToday}/${dashboard.totalScenarios}`
                          : ""}
                    </Text>
                  </View>
                  <Text style={styles.dayLabel}>{day}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable style={styles.featuredLesson} onPress={() => begin("interview")}>
            <Text style={styles.recommendedPill}>RECOMMENDED</Text>
            <Text style={styles.featuredTitle}>Business Presentation</Text>
            <Text style={styles.featuredCopy}>
              Master the art of pitching your ideas in professional English.
            </Text>
            <Text style={styles.featuredAction}>Start Lesson  →</Text>
          </Pressable>

          {scenarios.some(
            (scenario) =>
              !dashboard.completedScenarios.includes(scenario.id),
          ) && (
            <>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Scenarios</Text>
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
          <View style={styles.celebrationIcon}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
          </View>
          <Text style={styles.feedbackTitle}>Well Done!</Text>
          <Text style={styles.feedbackSubtitle}>
            You've successfully completed your English immersion session.
            Your progress today is remarkable!
          </Text>

          <View style={styles.scoreCard}>
            <Text style={styles.performanceTitle}>Performance Summary</Text>
            {(
              [
                ["Grammar", feedback.scores.grammar],
                ["Vocabulary", feedback.scores.vocabulary],
                ["Communication", feedback.scores.communication],
              ] as const
            ).map(([label, score]) => (
              <View style={styles.scoreItem} key={label}>
                <View style={styles.scoreCircle}>
                  <Text style={styles.score}>{score}%</Text>
                </View>
                <Text style={styles.scoreLabel}>{label}</Text>
                <Text style={styles.scoreGain}>+5% today</Text>
              </View>
            ))}
          </View>

          <View style={styles.insightCard}>
            <Text style={styles.cardLabel}>Coach feedback</Text>
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
  safe: { flex: 1, backgroundColor: "#F8FAF8" },
  flex: { flex: 1 },
  home: { padding: 22, paddingBottom: 48 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 36 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#0D631B", fontSize: 22, fontWeight: "900" },
  brand: { color: "#0D631B", fontSize: 20, fontWeight: "900", marginLeft: 6, flex: 1 },
  pointsPill: { backgroundColor: "#BDEFBE", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22 },
  pointsText: { color: "#3C6842", fontSize: 12, fontWeight: "700" },
  welcome: { marginBottom: 34 },
  welcomeTitle: { color: "#191C1B", fontSize: 38, lineHeight: 46, fontWeight: "900", letterSpacing: -1 },
  welcomeText: { color: "#707A6C", fontSize: 16, lineHeight: 25, marginTop: 8, maxWidth: 330 },
  hero: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 26, marginBottom: 24, alignItems: "center", borderWidth: 1, borderColor: "#F1F4F1" },
  dailyGoalTitle: { color: "#191C1B", fontSize: 22, fontWeight: "800" },
  goalRing: { width: 150, height: 150, borderRadius: 75, borderWidth: 13, borderColor: "#0D631B", borderLeftColor: "#E6E9E7", alignItems: "center", justifyContent: "center", marginTop: 28 },
  goalRingInner: { width: 116, height: 116, borderRadius: 58, alignItems: "center", justifyContent: "center" },
  goalFraction: { color: "#0D631B", fontSize: 38, fontWeight: "900" },
  goalTopics: { color: "#707A6C", fontSize: 12, marginTop: -4 },
  goalMessage: { color: "#40493D", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 26, maxWidth: 260 },
  continueButton: { width: "100%", backgroundColor: "#0D631B", borderRadius: 999, paddingVertical: 15, alignItems: "center", marginTop: 22 },
  continueButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  streakCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: "#F1F4F1" },
  streakHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  streakLabel: { color: "#707A6C", fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  streakCount: { color: "#0D631B", fontSize: 13, fontWeight: "900" },
  streakDays: { flexDirection: "row", justifyContent: "space-between", marginTop: 22 },
  streakDay: { alignItems: "center", width: 54 },
  dayDot: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E6E9E7", alignItems: "center", justifyContent: "center" },
  dayDotDone: { backgroundColor: "#0D631B" },
  dayDotToday: { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#0D631B", borderStyle: "dashed" },
  dayCheck: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  dayText: { color: "#0D631B", fontSize: 10, fontWeight: "900" },
  dayLabel: { color: "#707A6C", fontSize: 10, marginTop: 7 },
  featuredLesson: { minHeight: 190, borderRadius: 24, backgroundColor: "#2E7D32", padding: 24, marginBottom: 46, justifyContent: "flex-end", overflow: "hidden" },
  recommendedPill: { position: "absolute", top: 18, left: 22, color: "#FFFFFF", fontSize: 10, backgroundColor: "#5E9963", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  featuredTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900" },
  featuredCopy: { color: "#E8F5E9", fontSize: 14, lineHeight: 21, marginTop: 8, maxWidth: 260 },
  featuredAction: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", marginTop: 18 },
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
  sectionTitle: { color: "#191C1B", fontSize: 24, lineHeight: 30, fontWeight: "900", maxWidth: 200 },
  sectionMeta: { color: "#0D631B", fontSize: 12, lineHeight: 17, textAlign: "right", fontWeight: "700" },
  scenarioCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#F1F4F1",
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  scenarioIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#BDEFBE",
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
  bottomNav: { flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 24, padding: 6, marginTop: 28, borderWidth: 1, borderColor: "#F1F4F1" },
  navItem: { flex: 1, alignItems: "center", paddingVertical: 9 },
  navActive: { flex: 1, alignItems: "center", paddingVertical: 9, backgroundColor: "#BDEFBE", borderRadius: 18 },
  navIcon: { color: "#40493D", fontSize: 18 },
  navIconActive: { color: "#0D631B", fontSize: 18, fontWeight: "900" },
  navLabel: { color: "#40493D", fontSize: 9, marginTop: 3 },
  navLabelActive: { color: "#0D631B", fontSize: 9, fontWeight: "700", marginTop: 3 },
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
  finishButton: { marginLeft: "auto", backgroundColor: "#0D631B", borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 },
  finishText: { color: "#FFFFFF", fontWeight: "800" },
  messages: { flex: 1 },
  messagesContent: { padding: 18, paddingBottom: 28 },
  coachNote: { alignSelf: "center", backgroundColor: "#E8F5E9", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 20 },
  coachNoteText: { color: "#0D631B", fontSize: 12 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 16 },
  userMessageRow: { justifyContent: "flex-end" },
  avatar: { width: 31, height: 31, borderRadius: 11, backgroundColor: "#DCFCE7", alignItems: "center", justifyContent: "center", marginRight: 8 },
  bubble: { maxWidth: "82%", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 16 },
  aiBubble: { backgroundColor: "#FFFFFF", borderBottomLeftRadius: 6, borderWidth: 1, borderColor: "#EAECF0" },
  userBubble: { backgroundColor: "#E8F5E9", borderBottomRightRadius: 6 },
  messageText: { color: "#1D2939", fontSize: 15, lineHeight: 22 },
  userMessageText: { color: "#191C1B" },
  listen: { marginTop: 8, alignSelf: "flex-start" },
  listenText: { color: "#15803D", fontSize: 11, fontWeight: "700" },
  typing: { flexDirection: "row", alignItems: "center", marginLeft: 40, gap: 7 },
  typingText: { color: "#667085", fontSize: 12 },
  composer: { flexDirection: "row", alignItems: "flex-end", backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EAECF0" },
  input: { flex: 1, minHeight: 50, maxHeight: 110, backgroundColor: "#FFFFFF", borderRadius: 999, borderWidth: 1, borderColor: "#BFCABA", paddingHorizontal: 18, paddingVertical: 13, color: "#191C1B", fontSize: 14 },
  sendButton: { width: 45, height: 45, borderRadius: 23, backgroundColor: "#0D631B", alignItems: "center", justifyContent: "center", marginLeft: 9 },
  sendText: { color: "#FFFFFF", fontSize: 25, fontWeight: "700", marginTop: -2 },
  micButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#2E7D32", alignItems: "center", justifyContent: "center", marginLeft: 9 },
  micButtonActive: { backgroundColor: "#FEE4E2", borderWidth: 1, borderColor: "#FDA29B" },
  micText: { fontSize: 19, color: "#D92D20", fontWeight: "800" },
  disabled: { opacity: 0.4 },
  voiceHint: { backgroundColor: "#FFFFFF", textAlign: "center", color: "#98A2B3", fontSize: 10, paddingTop: 6, paddingBottom: 9 },
  listeningHint: { color: "#D92D20", fontWeight: "700" },
  feedbackPage: { padding: 22, paddingBottom: 48 },
  celebrationIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#88D982", alignSelf: "center", alignItems: "center", justifyContent: "center", marginTop: 20 },
  celebrationEmoji: { fontSize: 31 },
  feedbackEyebrow: { textAlign: "center", color: "#0D631B", fontSize: 11, fontWeight: "900", letterSpacing: 1.4, marginTop: 10 },
  feedbackTitle: { textAlign: "center", color: "#0D631B", fontSize: 34, fontWeight: "900", marginTop: 20 },
  feedbackSubtitle: { textAlign: "center", color: "#40493D", lineHeight: 22, marginTop: 8, marginBottom: 34, paddingHorizontal: 12 },
  scoreCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, marginBottom: 18, borderWidth: 1, borderColor: "#F1F4F1" },
  performanceTitle: { color: "#191C1B", fontSize: 20, fontWeight: "900", marginBottom: 18 },
  scoreItem: { alignItems: "center", marginBottom: 24 },
  scoreCircle: { width: 92, height: 92, borderRadius: 46, borderWidth: 8, borderColor: "#0D631B", borderLeftColor: "#E6E9E7", alignItems: "center", justifyContent: "center" },
  score: { color: "#0D631B", fontSize: 20, fontWeight: "900" },
  scoreLabel: { color: "#40493D", fontSize: 12, marginTop: 10 },
  scoreGain: { color: "#0D631B", fontSize: 10, marginTop: 3 },
  insightCard: { backgroundColor: "#E8F5E9", borderRadius: 24, padding: 24, marginBottom: 24, borderWidth: 1, borderColor: "#BDEFBE" },
  cardLabel: { color: "#0D631B", fontSize: 20, textAlign: "center", fontWeight: "800" },
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
  flashcardProgressFill: { height: "100%", borderRadius: 5, backgroundColor: "#0D631B" },
  studyCard: { flex: 1, maxHeight: 430, minHeight: 330, backgroundColor: "#E8F5E9", borderRadius: 30, marginTop: 32, padding: 28, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#D9E6DA" },
  studyCardFlipped: { backgroundColor: "#F2F4F2" },
  studyCardSide: { position: "absolute", top: 25, color: "#0D631B", backgroundColor: "#BDEFBE", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  studyWord: { color: "#0D631B", fontSize: 38, fontWeight: "900", textAlign: "center" },
  studyMeaning: { color: "#0D631B", fontSize: 31, fontWeight: "900", textAlign: "center" },
  studyExample: { color: "#40493D", fontSize: 16, lineHeight: 24, fontStyle: "italic", textAlign: "center", marginTop: 22 },
  studyHint: { position: "absolute", bottom: 25, color: "#707A6C", fontSize: 11 },
  flashcardControls: { flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 28 },
  arrowButton: { width: 66, height: 58, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D0D5DD", alignItems: "center", justifyContent: "center" },
  arrowButtonPrimary: { backgroundColor: "#0D631B", borderColor: "#0D631B" },
  arrowButtonText: { color: "#101828", fontSize: 27, fontWeight: "800" },
  arrowButtonPrimaryText: { color: "#FFFFFF", fontSize: 27, fontWeight: "800" },
  primaryButton: { backgroundColor: "#0D631B", borderRadius: 999, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
});
