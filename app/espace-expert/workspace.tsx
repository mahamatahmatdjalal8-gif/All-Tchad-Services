"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, BarChart3, Bookmark, Briefcase, ChevronRight, CircleHelp, Clock, Eye, FileText, GraduationCap, Heart, Images, LogOut, Map, MapPin, MessageCircle, MoreHorizontal, Pencil, Settings, Share2, ShieldCheck, Star, Store, TrendingUp, UserRound, UsersRound, Wallet, Wrench } from "lucide-react";
import AppBottomNav from "../app-bottom-nav";
import ProfileMediaModal, {
  type ProfileMediaKind,
} from "./profile-media-modal";

type Expert = { id: number; name: string; phone: string; trade: string; area: string; coverage: string; experience: number; availability: string; workingHours: string | null; workshopAddress: string | null; profileBio: string | null; profileImageKey: string | null; coverImageKey: string | null; status: string; reviewNote: string | null };
type PostComment = { id: number; body: string; customerName: string; createdAt: string; replies: { id: number; body: string; createdAt: string }[] };
type Post = { id: number; requestId: number | null; postType: string; body: string; imageKey: string | null; moderationStatus: string; createdAt: string; viewCount: number; likeCount: number; commentCount: number; favoriteCount: number; shareCount: number; comments: PostComment[] };
type ServiceRequest = {
  id: number; reference: string; customerName: string; service: string; city: string; district: string; urgency: string; status: string; details: string; createdAt: string; updatedAt: string;
  requesterExpertId: number | null; targetExpertId: number | null; requestKind: string; assignedArtisan: string | null;
  expertDecision: string; rejectionReason: string | null; quoteAmount: number; laborAmount: number; materialAmount: number; quoteDetails: string | null; quoteStatus: string; scheduledFor: string | null;
  beforeImageKey: string | null; afterImageKey: string | null; completedAt: string | null; commissionAmount: number; commissionStatus: string;
  clientRequestedFor: string | null; materialsNeeded: string | null; arrivedAt: string | null; problemImageKey: string | null; cancellationReason: string | null;
  locationLat: string | null; locationLng: string | null;
};
type Message = { id: number; requestId: number; senderExpertId: number | null; senderType: string; senderName: string; body: string; createdAt: string };
type Review = { id: number; customerName: string; rating: number | null; details: string; createdAt: string };
type Member = { id: number; name: string; status: string; trade: string; area: string };
type InitialData = { expert: Expert; posts: Post[]; requests: ServiceRequest[]; outgoingRequests: ServiceRequest[]; messages: Message[]; reviews: Review[]; members: Member[]; followerCount: number; followingCount: number; favoriteCount: number };
type Tab = "dashboard" | "edit-profile" | "missions" | "messages" | "posts" | "profile" | "settings" | "support";
type ProfileSection = "overview" | "about" | "posts" | "reviews";
type DashboardGroup = "activity" | "portfolio" | "progression" | "identity";
type DashboardPanel = "revenue" | "statistics" | "planning" | null;

const statusLabels: Record<string, string> = { new: "Nouvelle", assigned: "À préparer", in_progress: "En cours", completed: "Terminée", cancelled: "Annulée" };
const quoteLabels: Record<string, string> = { not_sent: "Devis à préparer", pending: "Réponse du client", accepted: "Devis accepté", rejected: "Devis refusé" };
const postOptions = [
  { id: "work", icon: "📷", label: "Réalisation", prompt: "Décrivez le problème, votre intervention et le résultat obtenu…" },
  { id: "before-after", icon: "◫", label: "Avant / après", prompt: "Expliquez la situation avant votre intervention puis le résultat après…" },
  { id: "available", icon: "●", label: "Disponibilité", prompt: "Indiquez vos horaires, votre zone et les services disponibles…" },
  { id: "tip", icon: "✦", label: "Conseil", prompt: "Partagez un conseil simple et utile lié à votre métier…" },
  { id: "offer", icon: "₣", label: "Offre", prompt: "Présentez le service proposé, la zone et une indication de prix…" },
];
const postLabels = Object.fromEntries(postOptions.map((option) => [option.id, option.label]));
const dateLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
const dateTimeLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const conversationTime = (value: string) => { const date = new Date(value); const today = new Date(); return date.toDateString() === today.toDateString() ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date) : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date); };
const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
const withPostMetrics = (post: Post): Post => ({ ...post, moderationStatus: post.moderationStatus || "published", comments: post.comments || [], viewCount: post.viewCount || 0, likeCount: post.likeCount || 0, commentCount: post.commentCount || 0, favoriteCount: post.favoriteCount || 0, shareCount: post.shareCount || 0 });

const journeySteps = [
  { title: "Demande", description: "Le besoin a été envoyé à l’expert." },
  { title: "Discussion", description: "Échangez dans la messagerie interne." },
  { title: "Acceptation", description: "L’expert confirme qu’il peut intervenir." },
  { title: "Devis", description: "Le prix et le rendez-vous sont validés." },
  { title: "Mission", description: "L’intervention peut commencer." },
  { title: "Travail terminé", description: "Le résultat et les preuves sont enregistrés." },
  { title: "Avis", description: "Le demandeur note le service réalisé." },
];

function getJourneyState(request: ServiceRequest, requestMessages: Message[]) {
  const discussionStarted = requestMessages.some((message) => message.senderType !== "system");
  const accepted = request.expertDecision === "accepted";
  const quoteAccepted = request.quoteStatus === "accepted";
  const missionStarted = request.status === "in_progress" || request.status === "completed";
  const workCompleted = request.status === "completed";
  const done = [true, discussionStarted || accepted, accepted, quoteAccepted, missionStarted, workCompleted, false];
  const current = Math.max(0, done.findIndex((stepDone) => !stepDone));
  return { done, current };
}

export default function ExpertWorkspace({ initialData }: { initialData: InitialData }) {
  const expert = initialData.expert;
  const isVerifiedExpert = expert.status === "accepted";
  const canApply = expert.status === "account_only" || expert.status === "rejected";
  const [requests, setRequests] = useState(initialData.requests);
  const [outgoingRequests, setOutgoingRequests] = useState(initialData.outgoingRequests || []);
  const [posts, setPosts] = useState(initialData.posts);
  const [messages, setMessages] = useState(initialData.messages);
  const [tab, setTab] = useState<Tab>("profile");
  const [activeRequest, setActiveRequest] = useState(initialData.requests.find((item) => item.requesterExpertId)?.id ?? initialData.outgoingRequests?.[0]?.id ?? initialData.requests[0]?.id ?? 0);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [postType, setPostType] = useState("work");
  const [availability, setAvailability] = useState(expert.availability);
  const [coverage, setCoverage] = useState(expert.coverage);
  const [workshopAddress, setWorkshopAddress] = useState(expert.workshopAddress || "");
  const [workingHours, setWorkingHours] = useState(expert.workingHours || "Lundi–samedi · 8h–18h");
  const [profileBio, setProfileBio] = useState(expert.profileBio || "");
  const [profilePhotoVersion, setProfilePhotoVersion] = useState(0);
  const [coverPhotoVersion, setCoverPhotoVersion] = useState(0);
  const [profileMediaOpen, setProfileMediaOpen] =
    useState<ProfileMediaKind | null>(null);
  const [hasProfilePhoto, setHasProfilePhoto] = useState(Boolean(expert.profileImageKey));
  const [hasCoverPhoto, setHasCoverPhoto] = useState(Boolean(expert.coverImageKey));
  const [profileSection, setProfileSection] = useState<ProfileSection>("overview");
  const [composerOpen, setComposerOpen] = useState(false);
  const [postView, setPostView] = useState<"list" | "grid">("list");
  const [messageSearch, setMessageSearch] = useState("");
  const [messageFilter, setMessageFilter] = useState<"all" | "unread">("all");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [missionFilter, setMissionFilter] = useState<"all" | "new" | "accepted" | "in_progress" | "completed">("all");
  const [missionView, setMissionView] = useState<"journey" | "quote" | "proofs">("journey");
  const [proofKind, setProofKind] = useState<"before" | "after">("before");
  const [dashboardGroup, setDashboardGroup] = useState<DashboardGroup>("activity");
  const [dashboardPanel, setDashboardPanel] = useState<DashboardPanel>(null);

  const conversationRequests = useMemo(() => [...requests.filter((request) => request.requesterExpertId), ...outgoingRequests.filter((outgoing) => !requests.some((incoming) => incoming.id === outgoing.id))], [requests, outgoingRequests]);
  const currentRequest = conversationRequests.find((item) => item.id === activeRequest);
  const currentJourney = currentRequest ? getJourneyState(currentRequest, messages.filter((message) => message.requestId === currentRequest.id)) : null;
  const isOutgoingConversation = Boolean(currentRequest?.requesterExpertId === expert.id);
  const conversationPartner = (request: ServiceRequest) => request.requesterExpertId === expert.id ? request.assignedArtisan || "Expert" : request.customerName;
  const messageIsMine = (message: Message) => message.senderExpertId ? message.senderExpertId === expert.id : message.senderType === "expert";
  const completed = requests.filter((item) => item.status === "completed").length;
  const active = requests.filter((item) => item.status === "assigned" || item.status === "in_progress").length;
  const awaitingDecision = requests.filter((item) => item.expertDecision === "pending" && item.status !== "cancelled").length;
  const acceptedQuotes = requests.filter((item) => item.quoteStatus === "accepted" && item.status === "assigned").length;
  const totalRevenue = requests.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.quoteAmount, 0);
  const commissionDue = requests.filter((item) => item.commissionStatus === "due").reduce((sum, item) => sum + item.commissionAmount, 0);
  const averageRating = useMemo(() => { const ratings = initialData.reviews.flatMap((review) => review.rating ? [review.rating] : []); return ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—"; }, [initialData.reviews]);
  const numericRating = Number(averageRating) || 0;
  const roundedRating = Math.round(numericRating);
  const recommendationRate = initialData.reviews.length
    ? Math.round((initialData.reviews.filter((review) => (review.rating || 0) >= 4).length / initialData.reviews.length) * 100)
    : 0;
  const profileScore = [expert.phone, expert.area, coverage, availability, workshopAddress, expert.profileImageKey || profilePhotoVersion, posts.length].filter(Boolean).length;
  const profilePercent = Math.round((profileScore / 7) * 100);
  const selectedOption = postOptions.find((option) => option.id === postType) ?? postOptions[0];
  const clientMessageCount = messages.filter((message) => message.senderType !== "system" && !messageIsMine(message)).length;
  const allConversations = useMemo(() => conversationRequests.map((request) => {
    const thread = messages.filter((message) => message.requestId === request.id);
    const lastMessage = thread.at(-1);
    return { request, thread, lastMessage, unread: Boolean(lastMessage && !messageIsMine(lastMessage) && lastMessage.senderType !== "system") };
  }), [conversationRequests, messages]);
  const conversations = useMemo(() => allConversations.filter(({ request, unread }) => {
    const term = messageSearch.trim().toLocaleLowerCase("fr");
    const matchesSearch = !term || `${conversationPartner(request)} ${request.service} ${request.district}`.toLocaleLowerCase("fr").includes(term);
    return matchesSearch && (messageFilter === "all" || unread);
  }), [allConversations, messageSearch, messageFilter]);
  const unreadConversationCount = allConversations.filter((conversation) => conversation.unread).length;
  const filteredMissions = requests.filter((item) => missionFilter === "all" || missionFilter === "new" ? missionFilter === "all" || item.expertDecision === "pending" : missionFilter === "accepted" ? item.status === "assigned" : item.status === missionFilter);
  const urgentMissions = requests.filter((item) => item.urgency.toLowerCase().includes("urgent") && !["completed", "cancelled"].includes(item.status));
  const scheduledMissions = requests.filter((item) => item.scheduledFor && !["completed", "cancelled"].includes(item.status)).sort((a, b) => Date.parse(a.scheduledFor || "") - Date.parse(b.scheduledFor || ""));
  const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
  const weeklyRevenue = requests.filter((item) => item.status === "completed" && item.completedAt && new Date(item.completedAt) >= startOfWeek).reduce((sum, item) => sum + item.quoteAmount, 0);
  const monthlyRevenue = requests.filter((item) => item.status === "completed" && item.completedAt && new Date(item.completedAt) >= startOfMonth).reduce((sum, item) => sum + item.quoteAmount, 0);
  const totalPostViews = posts.reduce((sum, post) => sum + (post.viewCount || 0), 0);
  const totalPostLikes = posts.reduce((sum, post) => sum + (post.likeCount || 0), 0);
  const totalPostComments = posts.reduce((sum, post) => sum + (post.commentCount || 0), 0);
  const totalPostFavorites = posts.reduce((sum, post) => sum + (post.favoriteCount || 0), 0);
  const totalPostShares = posts.reduce((sum, post) => sum + (post.shareCount || 0), 0);
  const totalPostInteractions = totalPostLikes + totalPostComments + totalPostFavorites + totalPostShares;
  const uniqueClientCount = new Set(requests.map((item) => item.customerName.trim().toLocaleLowerCase("fr")).filter(Boolean)).size;
  const photoCount = posts.filter((post) => Boolean(post.imageKey)).length + requests.filter((item) => Boolean(item.beforeImageKey)).length + requests.filter((item) => Boolean(item.afterImageKey)).length;
  const topPosts = [...posts].sort((a, b) => ((b.viewCount || 0) + ((b.likeCount || 0) + (b.commentCount || 0) + (b.favoriteCount || 0) + (b.shareCount || 0)) * 3) - ((a.viewCount || 0) + ((a.likeCount || 0) + (a.commentCount || 0) + (a.favoriteCount || 0) + (a.shareCount || 0)) * 3)).slice(0, 3);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const params = new URLSearchParams(window.location.search);
      const requestedTab = params.get("tab") as Tab | null;
      if (requestedTab && ["dashboard", "edit-profile", "missions", "messages", "posts", "profile", "settings", "support"].includes(requestedTab)) setTab(requestedTab);
      const requestedType = params.get("type");
      if (requestedType && postOptions.some((option) => option.id === requestedType)) { setPostType(requestedType); setTab("posts"); }
      const requestedRequest = Number(params.get("request"));
      if (Number.isInteger(requestedRequest) && conversationRequests.some((item) => item.id === requestedRequest)) { setActiveRequest(requestedRequest); setMobileThreadOpen(true); }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [conversationRequests]);

  useEffect(() => {
    if (tab !== "messages") return;
    let active = true;
    const refresh = async () => {
      const response = await fetch("/api/expert/messages");
      if (!response.ok || !active) return;
      const result = await response.json();
      const refreshed = (result.requests || []) as ServiceRequest[];
      setOutgoingRequests(refreshed);
      setMessages(result.messages || []);
    };
    refresh();
    const timer = window.setInterval(refresh, 10000);
    return () => { active = false; window.clearInterval(timer); };
  }, [tab, expert.id, expert.name]);

  useEffect(() => {
    setMissionView("journey");
    setProofKind("before");
  }, [activeRequest]);

  const go = (next: Tab) => { setProfileMenuOpen(false); setTab(next); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openProfileSection = (section: ProfileSection) => { setProfileSection(section); go("profile"); };
  const continueMissionJourney = () => {
    if (!currentRequest || !currentJourney) return;
    if (currentJourney.current === 1) {
      setMobileThreadOpen(true);
      go("messages");
      return;
    }
    if (currentJourney.current === 3) {
      setMissionView("quote");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (currentJourney.current === 5) {
      setMissionView("proofs");
      setProofKind(currentRequest.beforeImageKey ? "after" : "before");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    document.getElementById("mission-next-action")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const replaceRequest = (updated: ServiceRequest) => setRequests((current) => current.map((item) => item.id === updated.id ? updated : item));

  async function outgoingServiceAction(action: "accept_quote" | "reject_quote" | "cancel") {
    if (!currentRequest || currentRequest.requesterExpertId !== expert.id) return;
    setBusy(`outgoing-${action}`); setNotice("");
    const response = await fetch("/api/expert/service-request", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: currentRequest.id, action }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      setOutgoingRequests((current) => current.map((item) => item.id === result.request.id ? result.request : item));
      if (result.message) setMessages((current) => [...current, result.message]);
    } else setNotice(result.error || "Action impossible.");
    setBusy("");
  }

  async function missionAction(action: string, payload: Record<string, unknown> = {}) {
    if (!currentRequest) return false;
    setBusy(`mission-${action}`); setNotice("");
    const response = await fetch("/api/expert/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: currentRequest.id, action, ...payload }) });
    const result = await response.json();
    if (response.ok) {
      replaceRequest(result.request);
      if (result.message) setMessages((current) => [...current, result.message]);
      setNotice(action === "accept" ? "Mission acceptée. Préparez maintenant le devis." : action === "decline" ? (currentRequest.requesterExpertId ? "Refus envoyé dans la conversation." : "Refus enregistré. L’administration pourra affecter un autre expert.") : action === "quote" ? (currentRequest.requesterExpertId ? "Devis envoyé dans la conversation." : "Devis enregistré. Contactez le client par téléphone pour obtenir son accord.") : action === "confirm_quote" ? "Accord du client enregistré." : action === "start" ? "Intervention démarrée." : currentRequest.requesterExpertId ? "Intervention terminée." : "Intervention terminée. Le client peut maintenant vous noter.");
    } else setNotice(result.error || "Action impossible.");
    setBusy("");
    return response.ok;
  }

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    const saved = await missionAction("quote", { laborAmount: Number(values.laborAmount), materialAmount: Number(values.materialAmount), materialsNeeded: values.materialsNeeded, quoteDetails: values.quoteDetails, scheduledFor: values.scheduledFor });
    if (saved) setMissionView("journey");
  }

  async function declineMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    await missionAction("decline", { reason: values.reason });
  }

  async function uploadMissionPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!currentRequest) return; const form = event.currentTarget; const data = new FormData(form); data.set("requestId", String(currentRequest.id));
    const kind = String(data.get("kind")); setBusy(`photo-${kind}`); setNotice("");
    const response = await fetch("/api/expert/request-photos", { method: "POST", body: data }); const result = await response.json();
    if (response.ok) { replaceRequest({ ...currentRequest, [kind === "after" ? "afterImageKey" : "beforeImageKey"]: result.url }); if (result.post) { const metricPost = withPostMetrics(result.post); setPosts((current) => current.some((post) => post.id === metricPost.id) ? current.map((post) => post.id === metricPost.id ? metricPost : post) : [metricPost, ...current]); } form.reset(); if (kind === "before") setProofKind("after"); setNotice(result.publicationWarning ? "Photo enregistrée, mais la publication publique doit être réessayée." : result.published ? "Photos enregistrées : la réalisation Avant / Après est maintenant publique." : `Photo ${kind === "after" ? "après" : "avant"} enregistrée. Ajoutez l’autre photo pour publier la réalisation.`); }
    else setNotice(result.error || "Photo impossible à enregistrer."); setBusy("");
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy("publish"); setNotice("");
    const response = await fetch("/api/expert/posts", { method: "POST", body: new FormData(form) }); const result = await response.json();
    if (response.ok) { setPosts((current) => [withPostMetrics(result.post), ...current]); form.reset(); setPostType("work"); setComposerOpen(false); setProfileSection("posts"); setNotice("Votre publication est maintenant visible sur le réseau."); }
    else setNotice(result.error || "Publication impossible."); setBusy("");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy("message");
    const response = await fetch("/api/expert/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: activeRequest, content: new FormData(form).get("content") }) }); const result = await response.json();
    if (response.ok) { setMessages((current) => [...current, result.message]); form.reset(); } else setNotice(result.error || "Message impossible."); setBusy("");
  }

  async function startConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); setBusy("new-conversation"); setNotice("");
    const response = await fetch("/api/expert/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetExpertId: Number(values.targetExpertId), content: values.content }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { setOutgoingRequests((current) => [result.request, ...current]); setMessages((current) => [...current, result.message]); setActiveRequest(result.request.id); setNewConversationOpen(false); setMobileThreadOpen(true); form.reset(); }
    else setNotice(result.error || "Conversation impossible à créer.");
    setBusy("");
  }

  async function persistProfile(nextAvailability = availability) {
    const response = await fetch("/api/expert/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ availability: nextAvailability, coverage, workingHours, workshopAddress, profileBio }) }); const result = await response.json();
    setNotice(response.ok ? "Profil professionnel mis à jour." : result.error || "Mise à jour impossible."); return response.ok;
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy("profile"); setNotice(""); await persistProfile(); setBusy(""); }
  async function quickAvailability(value: string) { setAvailability(value); setBusy("availability"); setNotice(""); await persistProfile(value); setBusy(""); }

  async function uploadProfilePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy("profile-photo"); setNotice("");
    const response = await fetch("/api/expert/profile-photo", { method: "POST", body: new FormData(form) }); const result = await response.json();
    if (response.ok) { setProfilePhotoVersion(Date.now()); setHasProfilePhoto(true); form.reset(); setNotice("Photo de profil mise à jour."); } else setNotice(result.error || "Photo impossible à enregistrer."); setBusy("");
  }

  async function uploadCoverPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy("cover-photo"); setNotice("");
    const response = await fetch("/api/expert/cover-photo", { method: "POST", body: new FormData(form) }); const result = await response.json();
    if (response.ok) { setCoverPhotoVersion(Date.now()); setHasCoverPhoto(true); form.reset(); setNotice("Photo de couverture mise à jour."); } else setNotice(result.error || "Couverture impossible à enregistrer."); setBusy("");
  }

  async function signOut() { await fetch("/api/account", { method: "DELETE" }); window.location.href = "/profil"; }

  async function editPost(post: Post) {
    const body = window.prompt("Modifier le texte de la publication", post.body)?.trim();
    if (!body || body === post.body) return;
    setBusy(`edit-post-${post.id}`);
    const response = await fetch("/api/expert/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: post.id, body, postType: post.postType }) }); const result = await response.json();
    if (response.ok) setPosts((current) => current.map((item) => item.id === post.id ? { ...item, body: result.post.body, moderationStatus: result.post.moderationStatus } : item));
    setNotice(response.ok ? "Publication modifiée." : result.error || "Modification impossible."); setBusy("");
  }

  async function deletePost(post: Post) {
    if (!window.confirm("Supprimer définitivement cette publication ?")) return;
    setBusy(`delete-post-${post.id}`);
    const response = await fetch("/api/expert/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: post.id }) }); const result = await response.json();
    if (response.ok) setPosts((current) => current.filter((item) => item.id !== post.id));
    setNotice(response.ok ? "Publication supprimée." : result.error || "Suppression impossible."); setBusy("");
  }

  async function replyComment(event: FormEvent<HTMLFormElement>, postId: number, commentId: number) {
    event.preventDefault(); const form = event.currentTarget; setBusy(`reply-${commentId}`);
    const response = await fetch("/api/expert/posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reply", commentId, body: new FormData(form).get("body") }) }); const result = await response.json();
    if (response.ok) { setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: post.comments.map((comment) => comment.id === commentId ? { ...comment, replies: [...comment.replies, result.reply] } : comment) } : post)); form.reset(); }
    else setNotice(result.error || "Réponse impossible."); setBusy("");
  }

  return <main className={`expert-workspace expert-workspace-v2${tab === "profile" ? " expert-profile-nav-visible" : ""}`}>
    <aside>
      <Link className="space-brand" href="/"><span>AT</span><div><strong>Allô Tchad</strong><small>Espace professionnel</small></div></Link>
      <div className="space-profile">{hasProfilePhoto ? <img src={`/api/expert/profile-photo?v=${profilePhotoVersion}`} alt="Photo de profil" /> : <b>{expert.name.slice(0, 1).toUpperCase()}</b>}<strong>{expert.name}{isVerifiedExpert && <i>✓</i>}</strong><span>{isVerifiedExpert ? expert.trade : "Compte privé"}</span><small>{expert.area}</small></div>
      <div className="space-side-foot"><button onClick={signOut}>Se déconnecter</button></div>
    </aside>

    <section className="space-content">
      {(["missions", "edit-profile", "settings"] as Tab[]).includes(tab) && <header className="workspace-topbar workspace-back-only">
        <div className="workspace-heading"><button className="workspace-profile-back" onClick={() => go("profile")}>← Retour au profil</button></div>
      </header>}
      {notice && <p className="space-notice">{notice}</p>}

      {tab === "missions" && <section className="missions-layout">
        <aside className="mission-list"><header><span>Missions affectées</span><strong>{requests.length}</strong></header><nav className="mission-filters">{([['all','Toutes'],['new','Nouvelles'],['accepted','Acceptées'],['in_progress','En cours'],['completed','Terminées']] as const).map(([value,label]) => <button type="button" className={missionFilter === value ? "active" : ""} key={value} onClick={() => setMissionFilter(value)}>{label}</button>)}</nav>{filteredMissions.map((item) => <button className={activeRequest === item.id ? "active" : ""} key={item.id} onClick={() => setActiveRequest(item.id)}><b>{item.customerName.slice(0, 1).toUpperCase()}</b><span><strong>{item.service}</strong><small>{item.district} · {item.expertDecision === "pending" ? "À répondre" : statusLabels[item.status]}</small></span><em>{item.urgency.toLowerCase().includes("urgent") ? "!" : item.quoteStatus === "pending" ? "₣" : ""}</em></button>)}{!filteredMissions.length && <p>Aucune mission dans ce filtre.</p>}</aside>
        <div className="mission-workspace">{currentRequest ? <>
          <header className="mission-header"><div><span>{currentRequest.requesterExpertId ? "Demande directe d’un expert" : currentRequest.reference}</span><h2>{currentRequest.service}</h2><p>{currentRequest.customerName} · {currentRequest.city}, {currentRequest.district} · {currentRequest.urgency}</p></div><em>{currentRequest.expertDecision === "pending" ? "Réponse attendue" : statusLabels[currentRequest.status]}</em></header>
          {missionView === "journey" && currentJourney && <section className="mission-journey-card">
            <header><span>Parcours de la demande</span><strong>Étape {currentJourney.current + 1} sur {journeySteps.length}</strong></header>
            <div className="mission-journey-progress" aria-label={`Progression : étape ${currentJourney.current + 1} sur ${journeySteps.length}`}><i style={{ width: `${((currentJourney.current + 1) / journeySteps.length) * 100}%` }} /></div>
            <div className="mission-current-step"><b>{currentJourney.current + 1}</b><span><small>Maintenant</small><strong>{journeySteps[currentJourney.current].title}</strong><p>{journeySteps[currentJourney.current].description}</p></span></div>
            {currentJourney.current < 6 ? <button type="button" onClick={continueMissionJourney}>{currentJourney.current === 1 ? "Ouvrir la discussion" : currentJourney.current === 2 ? "Répondre à la demande" : currentJourney.current === 3 ? "Préparer le devis" : currentJourney.current === 4 ? "Gérer la mission" : "Ajouter les preuves"}<ChevronRight aria-hidden="true" /></button> : <p className="mission-review-wait"><Star aria-hidden="true" /> En attente de l’avis du demandeur</p>}
            <details><summary>Voir toutes les étapes</summary><ul>{journeySteps.map((step, index) => <li className={currentJourney.done[index] ? "done" : index === currentJourney.current ? "active" : ""} key={step.title}><b>{currentJourney.done[index] ? "✓" : index + 1}</b><span><strong>{step.title}</strong><small>{step.description}</small></span></li>)}</ul></details>
          </section>}
          {missionView === "journey" && <section className="mission-need"><span>Besoin du client</span><p>{currentRequest.details}</p>{currentRequest.clientRequestedFor && <p><strong>Report demandé :</strong> {dateTimeLabel(currentRequest.clientRequestedFor)}</p>}{currentRequest.locationLat && currentRequest.locationLng && <a className="mission-map-link" href={`https://www.google.com/maps?q=${currentRequest.locationLat},${currentRequest.locationLng}`} target="_blank" rel="noreferrer">📍 Ouvrir la position du client</a>}{currentRequest.problemImageKey && <img className="client-problem-photo" src={`/api/expert/request-photos?id=${currentRequest.id}&kind=problem`} alt="Photo du problème envoyée par le client" />}</section>}

          {missionView === "journey" && <section className="mission-actions" id="mission-next-action">
            {currentRequest.expertDecision === "pending" && <div className="decision-panel"><div><span>Étape suivante</span><h3>Accepter cette mission ?</h3><p>Vérifiez le besoin et votre disponibilité avant de répondre.</p></div><button className="accept-mission" disabled={Boolean(busy)} onClick={() => missionAction("accept")}>✓ Accepter la mission</button><form onSubmit={declineMission}><input name="reason" minLength={3} maxLength={300} placeholder="Raison du refus…" required /><button disabled={Boolean(busy)}>Refuser</button></form></div>}
            {currentRequest.expertDecision === "declined" && <div className="mission-state warning"><span>Mission refusée</span><p>{currentRequest.rejectionReason}. L’administration peut maintenant choisir un autre expert.</p></div>}
            {currentRequest.expertDecision === "accepted" && currentRequest.status !== "completed" && <>
              <div className={`mission-state quote-${currentRequest.quoteStatus}`}><span>{quoteLabels[currentRequest.quoteStatus]}</span>{currentRequest.quoteAmount > 0 && <strong>{money(currentRequest.quoteAmount)}</strong>}<p>{currentRequest.quoteStatus === "pending" ? (currentRequest.requesterExpertId ? "L’expert demandeur peut accepter ou refuser le devis dans la messagerie." : "Contactez le client par téléphone ou WhatsApp, puis confirmez son accord ici.") : currentRequest.quoteStatus === "accepted" ? "Le prix est validé. Respectez le montant annoncé." : currentRequest.quoteStatus === "rejected" ? (currentRequest.requesterExpertId ? "Discutez dans la messagerie puis envoyez un nouveau devis." : "Discutez avec le client puis envoyez un nouveau devis.") : "Annoncez le prix et l’heure d’arrivée avant de commencer."}</p>{currentRequest.scheduledFor && <small>Rendez-vous proposé : {dateTimeLabel(currentRequest.scheduledFor)}</small>}</div>
              {currentRequest.quoteStatus === "pending" && !currentRequest.requesterExpertId && <button className="confirm-client-quote" disabled={Boolean(busy)} onClick={() => missionAction("confirm_quote")}>✓ J’ai reçu l’accord du client</button>}
              {(currentRequest.quoteStatus === "not_sent" || currentRequest.quoteStatus === "rejected") && <button className="open-mission-wizard" type="button" onClick={() => setMissionView("quote")}>Préparer le devis <ChevronRight aria-hidden="true" /></button>}
              {currentRequest.quoteStatus === "accepted" && currentRequest.status === "assigned" && !currentRequest.arrivedAt && <button className="arrive-mission" disabled={Boolean(busy)} onClick={() => missionAction("arrive")}>📍 Je suis arrivé chez le client</button>}
              {currentRequest.quoteStatus === "accepted" && currentRequest.status === "assigned" && <button className="start-mission" disabled={Boolean(busy)} onClick={() => missionAction("start")}>▶ Démarrer l’intervention</button>}
              {currentRequest.status === "in_progress" && <button className="complete-mission" disabled={Boolean(busy)} onClick={() => missionAction("complete")}>✓ Déclarer l’intervention terminée</button>}
              {currentRequest.status === "in_progress" && <button className="open-proof-wizard" type="button" onClick={() => { setProofKind(currentRequest.beforeImageKey ? "after" : "before"); setMissionView("proofs"); }}>Ajouter les photos du travail <ChevronRight aria-hidden="true" /></button>}
            </>}
            {currentRequest.status === "completed" && <><div className="mission-state success"><span>Intervention terminée</span><strong>{money(currentRequest.quoteAmount)}</strong><p>Le client peut maintenant vous laisser une note.</p></div><button className="open-proof-wizard" type="button" onClick={() => { setProofKind(currentRequest.beforeImageKey ? "after" : "before"); setMissionView("proofs"); }}>Voir les preuves du travail <ChevronRight aria-hidden="true" /></button></>}
          </section>}

          {missionView === "quote" && <section className="mission-wizard-screen">
            <header className="mission-wizard-heading"><button type="button" onClick={() => setMissionView("journey")}>← Retour</button><div><span>Étape 4 sur 7</span><h3>Proposer un prix</h3><p>Complétez le devis avant de poursuivre la mission.</p></div></header>
            <div className="mission-wizard-progress"><i style={{ width: `${(4 / 7) * 100}%` }} /></div>
            <form className="quote-form mission-quote-wizard" onSubmit={submitQuote}><header><span>Devis simple</span><h3>Prix et rendez-vous</h3></header><div><label>Main-d’œuvre (FCFA)<input name="laborAmount" type="number" min="0" max="50000000" inputMode="numeric" defaultValue={currentRequest.laborAmount || ""} required /></label><label>Matériel (FCFA)<input name="materialAmount" type="number" min="0" max="50000000" inputMode="numeric" defaultValue={currentRequest.materialAmount || 0} required /></label></div><label>Matériel nécessaire<textarea name="materialsNeeded" maxLength={500} defaultValue={currentRequest.materialsNeeded || ""} placeholder="Câbles, tuyaux, pièces, quantité…" /></label><label>Détails du devis<textarea name="quoteDetails" minLength={5} maxLength={600} defaultValue={currentRequest.quoteDetails || ""} placeholder="Travail et matériel compris…" required /></label><label>Date et heure proposées<input name="scheduledFor" type="datetime-local" defaultValue={currentRequest.scheduledFor || currentRequest.clientRequestedFor || ""} /></label><div className="mission-wizard-actions"><button type="button" className="wizard-previous" onClick={() => setMissionView("journey")}>Retour</button><button disabled={Boolean(busy)}>Envoyer le devis <ChevronRight aria-hidden="true" /></button></div></form>
          </section>}

          {missionView === "proofs" && currentRequest.expertDecision === "accepted" && <section className="mission-wizard-screen">
            <header className="mission-wizard-heading"><button type="button" onClick={() => proofKind === "after" && !currentRequest.afterImageKey ? setProofKind("before") : setMissionView("journey")}>← Retour</button><div><span>Étape 6 sur 7 · Photo {proofKind === "before" ? "1" : "2"} sur 2</span><h3>{proofKind === "before" ? "Photo avant" : "Photo après"}</h3><p>{proofKind === "before" ? "Montrez clairement la situation avant l’intervention." : "Montrez le résultat obtenu après votre travail."}</p></div></header>
            <div className="mission-wizard-progress"><i style={{ width: proofKind === "before" ? "50%" : "100%" }} /></div>
            <section className="mission-photos mission-proof-single">{(() => { const kind = proofKind; const hasImage = kind === "before" ? currentRequest.beforeImageKey : currentRequest.afterImageKey; return <form onSubmit={uploadMissionPhoto}><input type="hidden" name="kind" value={kind} />{hasImage ? <img src={`/api/expert/request-photos?id=${currentRequest.id}&kind=${kind}`} alt={`Photo ${kind === "before" ? "avant" : "après"}`} /> : <div className="photo-placeholder">{kind === "before" ? "Avant" : "Après"}</div>}<label>{hasImage ? "Remplacer la photo" : `Ajouter la photo ${kind === "before" ? "avant" : "après"}`}<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /></label><label className="public-photo-consent"><input name="publicConsent" type="checkbox" value="yes" required /><span>Le client autorise la publication publique de cette photo.</span></label><div className="mission-wizard-actions"><button type="button" className="wizard-previous" onClick={() => kind === "after" ? setProofKind("before") : setMissionView("journey")}>Retour</button><button disabled={Boolean(busy)}>{busy === `photo-${kind}` ? "Envoi…" : kind === "before" ? "Enregistrer et continuer" : "Enregistrer la photo"}<ChevronRight aria-hidden="true" /></button></div></form>; })()}<small>Après les deux photos, la réalisation devient publique. Ne montrez aucun visage, numéro ou adresse privée.</small>{currentRequest.beforeImageKey && currentRequest.afterImageKey && <button type="button" className="finish-proof-wizard" onClick={() => setMissionView("journey")}>Terminer et revenir à la mission ✓</button>}</section>
          </section>}

        </> : <div className="choose-thread">Sélectionnez une mission.</div>}</div>
      </section>}

      {tab === "messages" && <section className={`expert-messenger messenger-modern ${mobileThreadOpen ? "thread-open" : ""}`}>
        <aside className="conversation-list"><header><div><strong>Discussions</strong><span>{unreadConversationCount > 0 ? `${unreadConversationCount} non lue${unreadConversationCount > 1 ? "s" : ""}` : "À jour"}</span></div><button type="button" className={newConversationOpen ? "active" : ""} aria-label="Nouveau message" onClick={() => setNewConversationOpen((open) => !open)}>✎</button></header>{newConversationOpen && <form className="new-conversation-form" onSubmit={startConversation}><strong>Nouveau message</strong><label>Choisir un profil<select name="targetExpertId" required defaultValue=""><option value="" disabled>Sélectionner une personne</option>{initialData.members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.status === "accepted" ? "Expert vérifié" : "Membre"}</option>)}</select></label><label>Premier message<textarea name="content" minLength={2} maxLength={600} rows={3} placeholder="Écrivez votre message…" required /></label><div><button type="button" onClick={() => setNewConversationOpen(false)}>Annuler</button><button disabled={busy === "new-conversation"}>{busy === "new-conversation" ? "Envoi…" : "Envoyer"}</button></div></form>}<label className="conversation-search"><i>⌕</i><input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Rechercher une discussion" aria-label="Rechercher une discussion" /></label><nav aria-label="Filtrer les discussions"><button className={messageFilter === "all" ? "active" : ""} onClick={() => setMessageFilter("all")}>Tout</button><button className={messageFilter === "unread" ? "active" : ""} onClick={() => setMessageFilter("unread")}>Non lus</button></nav><div className="conversation-items">{conversations.map(({ request, lastMessage, unread }) => { const partner = conversationPartner(request); return <button className={activeRequest === request.id ? "active" : ""} key={request.id} onClick={() => { setActiveRequest(request.id); setMobileThreadOpen(true); }}><b>{partner.slice(0, 1).toUpperCase()}</b><span><strong>{partner}</strong><small>{lastMessage ? `${messageIsMine(lastMessage) ? "Vous : " : ""}${lastMessage.body}` : `${request.service} · Aucun message`}</small></span><time>{lastMessage ? conversationTime(lastMessage.createdAt) : ""}</time>{unread && <i aria-label="Message non lu" />}</button>; })}{!conversations.length && <p>Aucune discussion trouvée.</p>}</div></aside>
        <div className="expert-thread conversation-view">{currentRequest ? <><header><button type="button" className="thread-back" onClick={() => setMobileThreadOpen(false)} aria-label="Retour aux discussions">‹</button><b>{conversationPartner(currentRequest).slice(0, 1).toUpperCase()}</b><div><strong>{conversationPartner(currentRequest)}</strong><span>{currentRequest.requestKind === "conversation" ? "Discussion privée" : currentRequest.requesterExpertId ? "Collaboration entre experts" : currentRequest.service} · {currentRequest.district}</span></div>{!currentRequest.requesterExpertId && <button type="button" className="thread-more" aria-label="Informations sur la mission" onClick={() => go("missions")}>•••</button>}</header><div className="thread-date"><span>{dateLabel(currentRequest.createdAt)}</span></div>{isOutgoingConversation && currentRequest.requestKind !== "conversation" && <section className="collaboration-service-card"><div><span>{currentRequest.service}</span><strong>{currentRequest.status === "cancelled" ? "Demande annulée" : currentRequest.status === "completed" ? "Service terminé" : currentRequest.quoteStatus === "not_sent" ? "En attente de la réponse" : quoteLabels[currentRequest.quoteStatus]}</strong></div>{currentRequest.quoteAmount > 0 && <b>{money(currentRequest.quoteAmount)}</b>}{currentRequest.quoteStatus === "pending" && <div className="collaboration-quote-actions"><button disabled={Boolean(busy)} onClick={() => outgoingServiceAction("accept_quote")}>Accepter le devis</button><button disabled={Boolean(busy)} onClick={() => outgoingServiceAction("reject_quote")}>Refuser</button></div>}{!["completed", "cancelled"].includes(currentRequest.status) && <button className="collaboration-cancel" disabled={Boolean(busy)} onClick={() => outgoingServiceAction("cancel")}>Annuler la demande</button>}</section>}<div className="expert-message-list">{messages.filter((message) => message.requestId === currentRequest.id).map((message) => <article className={message.senderType === "system" ? "system" : messageIsMine(message) ? "mine" : ""} key={message.id}><span>{message.senderName}</span><p>{message.body}</p><small>{dateTimeLabel(message.createdAt)}</small></article>)}{!messages.some((message) => message.requestId === currentRequest.id) && <p className="empty-thread">Envoyez un premier message.</p>}</div><form onSubmit={sendMessage}><span aria-hidden="true">💬</span><input name="content" maxLength={600} placeholder="Écrivez un message…" autoComplete="off" required /><button disabled={busy === "message"} aria-label="Envoyer le message">➤</button></form></> : <div className="choose-thread"><b>💬</b><strong>Vos discussions</strong><span>Choisissez une personne pour lire les messages et répondre.</span></div>}</div>
      </section>}

      {tab === "posts" && <>
        {!isVerifiedExpert ? <section className="publication-locked-card"><b><ShieldCheck aria-hidden="true" /></b><span>Publication verrouillée</span><h2>Faites valider votre compétence</h2><p>Vous pouvez déjà contacter les experts et discuter avec eux. Déposez votre candidature pour publier vos réalisations et apparaître dans l’annuaire.</p>{canApply ? <Link href="/#artisan">Déposer ma candidature →</Link> : <em>Candidature en cours de vérification</em>}</section> : <>
          {!hasProfilePhoto ? <section className="photo-required-card"><b>📷</b><span>Photo obligatoire</span><h2>Présentez-vous avant de publier</h2><p>Ajoutez une photo professionnelle claire. Elle accompagnera votre profil et renforcera la confiance des clients.</p><form onSubmit={uploadProfilePhoto}><input name="image" type="file" accept="image/jpeg,image/png,image/webp" required /><button disabled={busy === "profile-photo"}>{busy === "profile-photo" ? "Envoi…" : "Ajouter ma photo →"}</button></form></section> : <form className="post-composer" onSubmit={publish}><header><img className="composer-profile-photo" src={`/api/expert/profile-photo?v=${profilePhotoVersion}`} alt="Photo de profil" /><div><strong>Créer une publication professionnelle</strong><span>Visible publiquement par tous les visiteurs</span></div></header><fieldset className="post-type-options"><legend>Que souhaitez-vous publier ?</legend>{postOptions.map((option) => <button className={postType === option.id ? "active" : ""} type="button" key={option.id} onClick={() => setPostType(option.id)}><i>{option.icon}</i><span>{option.label}</span></button>)}</fieldset><input type="hidden" name="postType" value={postType} /><textarea name="body" minLength={10} maxLength={1200} rows={4} placeholder={selectedOption.prompt} required /><label>📷 Ajouter une photo de qualité<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label><p className="post-guidance">Votre publication sera publique. Ne publiez aucune adresse privée, pièce d’identité ou visage de client sans autorisation.</p><button disabled={busy === "publish"}>{busy === "publish" ? "Publication…" : `Publier publiquement · ${selectedOption.label} →`}</button></form>}
          <section className="my-posts"><header><h2>Mes publications</h2><span>{posts.length} au total</span></header>{posts.map((post) => <article key={post.id}><div><strong>{expert.name}<i>✓</i></strong><small>{dateLabel(post.createdAt)}</small></div><em>{postLabels[post.postType] || "Réalisation"}</em><p>{post.body}</p>{post.requestId ? <div className="my-before-after"><figure><img src={`/api/social/images/${post.id}?kind=before`} alt="Avant" /><figcaption>Avant</figcaption></figure><figure><img src={`/api/social/images/${post.id}?kind=after`} alt="Après" /><figcaption>Après</figcaption></figure></div> : post.imageKey && <div role="img" aria-label="Photo du travail" style={{ backgroundImage: `url(/api/social/images/${post.id})` }} />}</article>)}{!posts.length && <p className="no-posts">Publiez votre première réalisation pour présenter votre travail.</p>}</section>
        </>}
      </>}

      {tab === "dashboard" && <section className="expert-standalone-screen">
        <section className={`facebook-professional-dashboard dashboard-modern panel-${dashboardPanel || "none"}`}>
          <section className="dashboard-performance-hero">
            <header><div><span>Performance</span><h2>Vos résultats</h2></div><TrendingUp aria-hidden="true" /></header>
            <div>
              <button onClick={() => setDashboardPanel("revenue")}><b><Wallet aria-hidden="true" /></b><span><small>Mes revenus</small><strong>{money(totalRevenue)}</strong><em>Voir le détail <ChevronRight aria-hidden="true" /></em></span></button>
              <button disabled={!isVerifiedExpert} onClick={() => setDashboardPanel("statistics")}><b><BarChart3 aria-hidden="true" /></b><span><small>Mes statistiques</small><strong>{totalPostViews} vues</strong><em>{totalPostInteractions} interactions <ChevronRight aria-hidden="true" /></em></span></button>
            </div>
          </section>
          <section className="professional-command-center compact-dashboard-tools">
            <header><div><span>Tableau professionnel</span><h3>Que voulez-vous gérer ?</h3></div><small>{isVerifiedExpert ? "Profil actif" : "Compte privé"}</small></header>
            <nav className="professional-command-tabs" aria-label="Rubriques du tableau professionnel">
              <button className={dashboardGroup === "activity" ? "active" : ""} onClick={() => { setDashboardGroup("activity"); setDashboardPanel(null); }}><Briefcase aria-hidden="true" /><span>Activité</span></button>
              <button className={dashboardGroup === "portfolio" ? "active" : ""} onClick={() => { setDashboardGroup("portfolio"); setDashboardPanel(null); }}><Images aria-hidden="true" /><span>Portfolio</span></button>
              <button className={dashboardGroup === "progression" ? "active" : ""} onClick={() => { setDashboardGroup("progression"); setDashboardPanel(null); }}><GraduationCap aria-hidden="true" /><span>Progression</span></button>
              <button className={dashboardGroup === "identity" ? "active" : ""} onClick={() => { setDashboardGroup("identity"); setDashboardPanel(null); }}><UserRound aria-hidden="true" /><span>Profil</span></button>
            </nav>
            <div className="professional-command-grid">
              {dashboardGroup === "activity" && <article className="professional-command-group activity">
                <header><b><Briefcase aria-hidden="true" /></b><div><span>Activité</span><strong>Travail et échanges</strong></div></header>
                <div>
                  <button onClick={() => go("missions")}><Briefcase aria-hidden="true" /><span><strong>Mes missions</strong><small>{awaitingDecision + active} à suivre</small></span><em>{requests.length}</em><ChevronRight aria-hidden="true" /></button>
                  <button onClick={() => go("missions")}><UsersRound aria-hidden="true" /><span><strong>Mes clients</strong><small>Clients accompagnés</small></span><em>{uniqueClientCount}</em><ChevronRight aria-hidden="true" /></button>
                  <button onClick={() => go("messages")}><MessageCircle aria-hidden="true" /><span><strong>Mes messages</strong><small>{unreadConversationCount ? `${unreadConversationCount} non lu${unreadConversationCount > 1 ? "s" : ""}` : "À jour"}</small></span><em>{allConversations.length}</em><ChevronRight aria-hidden="true" /></button>
                  <button onClick={() => setDashboardPanel("planning")}><Clock aria-hidden="true" /><span><strong>Mon planning</strong><small>{scheduledMissions.length ? `${scheduledMissions.length} intervention${scheduledMissions.length > 1 ? "s" : ""} planifiée${scheduledMissions.length > 1 ? "s" : ""}` : "Aucun rendez-vous"}</small></span><ChevronRight aria-hidden="true" /></button>
                </div>
              </article>}
              {dashboardGroup === "portfolio" && <article className="professional-command-group portfolio">
                <header><b><Images aria-hidden="true" /></b><div><span>Portfolio</span><strong>Travaux et réputation</strong></div></header>
                <div>
                  <button disabled={!isVerifiedExpert} onClick={() => openProfileSection("posts")}><FileText aria-hidden="true" /><span><strong>Mes publications</strong><small>{isVerifiedExpert ? "Gérer mes contenus" : "Après validation"}</small></span><em>{posts.length}</em><ChevronRight aria-hidden="true" /></button>
                  <button disabled={!isVerifiedExpert} onClick={() => openProfileSection("posts")}><Images aria-hidden="true" /><span><strong>Mes photos</strong><small>Avant, après et réalisations</small></span><em>{photoCount}</em><ChevronRight aria-hidden="true" /></button>
                  <button onClick={() => openProfileSection("reviews")}><Star aria-hidden="true" /><span><strong>Mes avis</strong><small>{averageRating === "—" ? "Pas encore noté" : `${averageRating}/5`}</small></span><em>{initialData.reviews.length}</em><ChevronRight aria-hidden="true" /></button>
                </div>
              </article>}
              {dashboardGroup === "progression" && <article className="professional-command-group progression">
                <header><b><GraduationCap aria-hidden="true" /></b><div><span>Progression</span><strong>Compétences</strong></div></header>
                <div>
                  <button onClick={() => go("edit-profile")}><GraduationCap aria-hidden="true" /><span><strong>Mes formations</strong><small>Compléter mon parcours</small></span><ChevronRight aria-hidden="true" /></button>
                  <button onClick={() => isVerifiedExpert ? openProfileSection("about") : window.location.assign("/#artisan")}><BadgeCheck aria-hidden="true" /><span><strong>Ma certification</strong><small>{isVerifiedExpert ? "Validée" : expert.status === "pending" ? "En vérification" : "À demander"}</small></span><ChevronRight aria-hidden="true" /></button>
                </div>
              </article>}
              {dashboardGroup === "identity" && <article className="professional-command-group identity">
                <header><b><UserRound aria-hidden="true" /></b><div><span>Identité</span><strong>Présence publique</strong></div></header>
                <div><button onClick={() => go("profile")}><UserRound aria-hidden="true" /><span><strong>Mon profil</strong><small>Profil complété à {profilePercent}%</small></span><em>{profilePercent}%</em><ChevronRight aria-hidden="true" /></button></div>
              </article>}
            </div>
          </section>
          <section className="expert-availability professional-availability"><div><span>Disponibilité visible par les clients</span><strong>{availability}</strong></div><div>{["Disponible maintenant", "Occupé", "Indisponible"].map((value) => <button className={availability === value ? "active" : ""} disabled={busy === "availability"} key={value} onClick={() => quickAvailability(value)}>{value}</button>)}</div></section>
          <section className="dashboard-quick-stats"><button onClick={() => { setMissionFilter("new"); go("missions"); }}><span>À répondre</span><strong>{awaitingDecision}</strong><small>Nouvelles</small></button><button onClick={() => go("missions")}><span>En cours</span><strong>{active}</strong><small>Interventions</small></button><button onClick={() => go("missions")}><span>Terminées</span><strong>{completed}</strong><small>Travaux</small></button></section>
          {dashboardPanel && <button className="dashboard-detail-close" type="button" onClick={() => setDashboardPanel(null)}>← Revenir au résumé</button>}
          {urgentMissions.length > 0 && <button className="urgent-mission-reminder" onClick={() => { setMissionFilter("new"); go("missions"); }}><b>!</b><span><strong>{urgentMissions.length} mission{urgentMissions.length > 1 ? "s" : ""} urgente{urgentMissions.length > 1 ? "s" : ""}</strong><small>Répondez rapidement pour ne pas faire attendre le client.</small></span><em>Voir →</em></button>}
          <div className="professional-dashboard-grid" id="professional-finance"><article className="professional-revenue"><header><div><span>Revenus et commissions</span><h3>{money(totalRevenue)}</h3></div><b>₣</b></header><p><span>Cette semaine</span><strong>{money(weeklyRevenue)}</strong></p><p><span>Ce mois</span><strong>{money(monthlyRevenue)}</strong></p><p><span>Commission à régler</span><strong>{money(commissionDue)}</strong></p><p><span>Commission déjà réglée</span><strong>{money(requests.filter((item) => item.commissionStatus === "collected").reduce((sum, item) => sum + item.commissionAmount, 0))}</strong></p><button className="print-finance" onClick={() => window.print()}>Imprimer le relevé</button></article><article className="expert-profile-progress"><span>Qualité du profil</span><div><strong>{profilePercent}%</strong><i><em style={{ width: `${profilePercent}%` }} /></i></div><p>Une photo, des zones précises et des publications régulières rassurent les clients.</p><button onClick={() => go("edit-profile")}>Améliorer mon profil →</button></article></div>
          <section className="expert-planning"><header><div><span>Planning</span><h3>Prochaines interventions</h3></div><small>{workingHours}</small></header>{scheduledMissions.slice(0, 6).map((item) => <button key={item.id} onClick={() => { setActiveRequest(item.id); go("missions"); }}><time>{dateTimeLabel(item.scheduledFor!)}</time><span><strong>{item.service}</strong><small>{item.customerName} · {item.district}</small></span><em>{statusLabels[item.status]}</em></button>)}{!scheduledMissions.length && <p>Aucune intervention planifiée. Les rendez-vous acceptés apparaîtront ici.</p>}</section>
          <section className="expert-finance-history"><header><div><span>Historique financier</span><h3>Interventions et commissions</h3></div><button onClick={() => window.print()}>Télécharger le reçu</button></header>{requests.filter((item) => item.status === "completed").slice(0, 10).map((item) => <article key={item.id}><time>{item.completedAt ? dateLabel(item.completedAt) : dateLabel(item.updatedAt)}</time><span><strong>{item.service}</strong><small>{item.requesterExpertId ? `Collaboration avec ${item.customerName}` : `${item.reference} · ${item.customerName}`}</small></span><b>{money(item.quoteAmount)}</b><em className={`commission-${item.commissionStatus}`}>{item.commissionStatus === "collected" ? "Commission réglée" : item.commissionStatus === "due" ? "Commission à régler" : "Sans commission"}</em></article>)}{!requests.some((item) => item.status === "completed") && <p>Aucune intervention terminée pour le moment.</p>}</section>
          {isVerifiedExpert && <section className="publication-analytics" id="publication-performance">
            <header><div><span>Performance des publications</span><h3>Trafic de vos photos</h3><p>Les chiffres sont mis à jour à partir des interactions publiques.</p></div><b><TrendingUp aria-hidden="true" /></b></header>
            <div className="publication-metrics"><article><Eye aria-hidden="true" /><span>Vues</span><strong>{totalPostViews}</strong></article><article><TrendingUp aria-hidden="true" /><span>Interactions</span><strong>{totalPostInteractions}</strong></article><article><Heart aria-hidden="true" /><span>J’aime</span><strong>{totalPostLikes}</strong></article><article><MessageCircle aria-hidden="true" /><span>Commentaires</span><strong>{totalPostComments}</strong></article><article><Bookmark aria-hidden="true" /><span>Favoris</span><strong>{totalPostFavorites}</strong></article><article><Share2 aria-hidden="true" /><span>Partages</span><strong>{totalPostShares}</strong></article></div>
            <div className="top-publications"><header><strong>Meilleures publications</strong><button onClick={() => { setProfileSection("posts"); go("profile"); }}>Voir toutes</button></header>{topPosts.map((post, index) => <button key={post.id} onClick={() => { setProfileSection("posts"); go("profile"); }}><em>{index + 1}</em>{post.requestId ? <img src={`/api/social/images/${post.id}?kind=after`} alt="" /> : post.imageKey ? <img src={`/api/social/images/${post.id}`} alt="" /> : <b>AT</b>}<span><strong>{postLabels[post.postType] || "Réalisation"}</strong><small>{post.body}</small></span><i><Eye aria-hidden="true" /> {post.viewCount || 0}<Heart aria-hidden="true" /> {post.likeCount || 0}<MessageCircle aria-hidden="true" /> {post.commentCount || 0}</i></button>)}{!topPosts.length && <p>Publiez une photo pour commencer à mesurer son trafic.</p>}</div>
          </section>}
          <section className="recent-requests professional-recent"><header><h2>Missions récentes</h2><button onClick={() => go("missions")}>Tout voir</button></header>{requests.slice(0, 4).map((item) => <button key={item.id} onClick={() => { setActiveRequest(item.id); go("missions"); }}><b>{item.customerName.slice(0, 1).toUpperCase()}</b><span><strong>{item.service}</strong><small>{item.city}, {item.district} · {dateLabel(item.createdAt)}</small></span><em>{item.expertDecision === "pending" ? "À répondre" : statusLabels[item.status]}</em></button>)}{!requests.length && <p>Aucune mission affectée pour le moment.</p>}</section>
        </section>
      </section>}

      {tab === "edit-profile" && <section className="expert-standalone-screen profile-edit-screen">
        <section className="facebook-profile-editor">
          <header><div><span>Profil professionnel</span><h2>Modifier mes informations</h2></div></header>
          <form className="expert-profile-form" onSubmit={saveProfile}><label>Présentation courte<textarea value={profileBio} onChange={(event) => setProfileBio(event.target.value)} maxLength={220} placeholder="Présentez votre spécialité et votre manière de travailler…" /></label><label>Disponibilité<select value={availability} onChange={(event) => setAvailability(event.target.value)}><option>Disponible maintenant</option><option>Disponible sur rendez-vous</option><option>Occupé</option><option>Indisponible</option></select></label><label>Horaires de travail<input value={workingHours} onChange={(event) => setWorkingHours(event.target.value)} maxLength={180} placeholder="Ex. lundi–samedi, 8h–18h" /></label><label>Zones d’intervention<textarea value={coverage} onChange={(event) => setCoverage(event.target.value)} required /></label><label>Adresse de l’atelier<input value={workshopAddress} onChange={(event) => setWorkshopAddress(event.target.value)} placeholder="Facultatif" /></label><button disabled={busy === "profile"}>{busy === "profile" ? "Enregistrement…" : "Enregistrer les modifications"}</button></form>
        </section>
      </section>}

      {tab === "settings" && <section className="expert-standalone-screen expert-settings-screen">
        <section className="expert-settings-panel">
          <header><div><span>Compte expert</span><h2>Paramètres</h2><p>Gérez votre accès et l’assistance de votre espace professionnel.</p></div><b><Settings aria-hidden="true" /></b></header>
          <div className="expert-settings-list">
            <article><b><ShieldCheck aria-hidden="true" /></b><span><strong>Lié au compte personnel</strong><small>Votre page professionnelle est rattachée à votre identité personnelle validée.</small></span><em>Actif</em></article>
            <Link href="/confidentialite"><b><ShieldCheck aria-hidden="true" /></b><span><strong>Confidentialité</strong><small>Découvrez comment vos informations professionnelles sont protégées.</small></span><ChevronRight aria-hidden="true" /></Link>
            <Link href="/regles-experts"><b><FileText aria-hidden="true" /></b><span><strong>Règles des experts</strong><small>Consultez les règles de travail, de sécurité et de publication.</small></span><ChevronRight aria-hidden="true" /></Link>
            <Link href="/contact"><b><CircleHelp aria-hidden="true" /></b><span><strong>Aide et assistance</strong><small>Contactez l’administration en cas de problème avec votre accès.</small></span><ChevronRight aria-hidden="true" /></Link>
          </div>
          <button className="settings-signout" onClick={signOut}><LogOut aria-hidden="true" /><span><strong>Se déconnecter</strong><small>Fermer votre espace expert sur cet appareil</small></span></button>
        </section>
      </section>}

      {tab === "profile" && <section className="expert-social-profile">
        <section className="facebook-profile-head">
          <div className={`facebook-cover ${hasCoverPhoto ? "has-photo" : ""}`}>
            {hasCoverPhoto && <img src={`/api/expert/cover-photo?v=${coverPhotoVersion}`} alt="Photo de couverture professionnelle" />}
            {!hasCoverPhoto && <div><b>{expert.trade}</b><span>{expert.coverage}</span></div>}
            <button
              type="button"
              className="facebook-cover-photo-button"
              aria-label={
                hasCoverPhoto
                  ? "Voir la photo de couverture"
                  : "Ajouter une photo de couverture"
              }
              onClick={() => setProfileMediaOpen("cover")}
            />

            <button
              type="button"
              className="facebook-cover-edit-button"
              onClick={() => setProfileMediaOpen("cover")}
            >
              <span>📷</span>
              <b>
                {hasCoverPhoto
                  ? "Modifier la couverture"
                  : "Ajouter une couverture"}
              </b>
            </button>
            <div className="facebook-cover-menu"><button type="button" aria-label="Ouvrir les paramètres du compte" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)}><MoreHorizontal aria-hidden="true" /></button>{profileMenuOpen && <div role="menu"><button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); go("settings"); }}><Settings aria-hidden="true" /><span>Paramètres</span></button><button type="button" role="menuitem" className="cover-menu-signout" onClick={() => { setProfileMenuOpen(false); signOut(); }}><LogOut aria-hidden="true" /><span>Se déconnecter</span></button></div>}</div>
          </div>
          <div className="facebook-profile-identity">
            <div className="facebook-avatar-editor">
  <div>
    <button
      type="button"
      className="facebook-avatar-photo-button"
      aria-label={
        hasProfilePhoto
          ? "Voir la photo de profil"
          : "Ajouter une photo de profil"
      }
      onClick={() => setProfileMediaOpen("profile")}
    >
      {hasProfilePhoto ? (
        <img
          src={`/api/expert/profile-photo?v=${profilePhotoVersion}`}
          alt={`Photo de ${expert.name}`}
        />
      ) : (
        <b>
          {expert.name.slice(0, 1).toUpperCase()}
        </b>
      )}
    </button>

    <button
      type="button"
      className="facebook-avatar-camera"
      aria-label="Modifier la photo de profil"
      onClick={() => setProfileMediaOpen("profile")}
    >
      📷
    </button>
  </div>
</div>
            <div className="facebook-profile-name"><h2>{expert.name}{isVerifiedExpert && <i>✓</i>}</h2><p>{isVerifiedExpert ? profileBio || `${expert.trade} professionnel à ${expert.area}` : `Compte privé · ${expert.area}`}</p><div>{isVerifiedExpert ? <><strong>{initialData.followerCount}</strong> abonné{initialData.followerCount > 1 ? "s" : ""}<span>·</span><strong>{initialData.followingCount}</strong> suivi{initialData.followingCount > 1 ? "s" : ""}<span>·</span><strong>{completed}</strong> réalisation{completed > 1 ? "s" : ""}<span>·</span><strong>{initialData.reviews.length}</strong> avis</> : <><strong>{outgoingRequests.length}</strong> demande{outgoingRequests.length > 1 ? "s" : ""}<span>·</span><strong>{initialData.followingCount}</strong> expert{initialData.followingCount > 1 ? "s" : ""} suivi{initialData.followingCount > 1 ? "s" : ""}</>}</div></div>
            <div className="facebook-profile-actions"><button className="primary" onClick={() => go("dashboard")}><BarChart3 aria-hidden="true" /><span>Tableau professionnel</span></button><button className="profile-missions-button" onClick={() => go("missions")}><Briefcase aria-hidden="true" /><span>Mes missions</span>{awaitingDecision + active > 0 && <b>{awaitingDecision + active}</b>}</button><button onClick={() => go("edit-profile")}><Pencil aria-hidden="true" /><span>Modifier</span></button></div>
          </div>
          <nav className="facebook-profile-tabs" aria-label="Rubriques du profil">
            {isVerifiedExpert ? ([['overview', 'Tout'], ['about', 'À propos'], ['posts', 'Publications'], ['reviews', 'Avis clients']] as [ProfileSection, string][]).map(([section, label]) => <button className={profileSection === section ? "active" : ""} key={section} onClick={() => setProfileSection(section)}>{label}</button>) : <button className="active" type="button">Mon compte</button>}
          </nav>
        </section>

        {!isVerifiedExpert && <section className={`member-upgrade-card status-${expert.status}`}>
          <b><ShieldCheck aria-hidden="true" /></b>
          <div><span>{expert.status === "pending" ? "Candidature en vérification" : expert.status === "rejected" ? "Candidature à compléter" : "Compte privé actif"}</span><h2>{expert.status === "pending" ? "Votre dossier est en cours d’examen" : "Vous pouvez déjà demander des services"}</h2><p>{expert.status === "pending" ? "Vous gardez accès aux experts et à la messagerie pendant la vérification. Après acceptation, votre profil public et la publication seront activés." : "Recherchez un expert, envoyez-lui une demande directe et discutez dans la messagerie. Si vous avez une compétence, faites-la valider pour devenir visible publiquement."}</p>{expert.reviewNote && <small>{expert.reviewNote}</small>}</div>
          <div>{canApply && <Link href="/#artisan">Déposer ma candidature</Link>}<button type="button" onClick={() => go("messages")}>Mes discussions</button><Link href="/experts">Trouver un expert</Link></div>
        </section>}

        {isVerifiedExpert && hasProfilePhoto && (profileSection === "overview" || profileSection === "posts") && <section className="profile-publish-entry">
          {!composerOpen ? <button className="profile-publish-trigger" type="button" onClick={() => setComposerOpen(true)}><img src={`/api/expert/profile-photo?v=${profilePhotoVersion}`} alt="" /><span><strong>Créer une publication</strong><small>Réalisation, avant/après, conseil, disponibilité ou offre</small></span><b>＋</b></button> : <form className="facebook-post-composer profile-composer-open" onSubmit={publish}><header><img src={`/api/expert/profile-photo?v=${profilePhotoVersion}`} alt="" /><textarea name="body" minLength={10} maxLength={1200} rows={3} autoFocus placeholder="Décrivez votre travail ou partagez une information utile…" required /></header><input type="hidden" name="postType" value={postType} /><div className="facebook-compose-types">{postOptions.map((option) => <button type="button" className={postType === option.id ? "active" : ""} key={option.id} onClick={() => setPostType(option.id)}><i>{option.icon}</i>{option.label}</button>)}</div><footer><label>📷 Ajouter une photo<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label><button className="composer-cancel" type="button" onClick={() => setComposerOpen(false)}>Annuler</button><button disabled={busy === "publish"}>{busy === "publish" ? "Publication…" : "Publier"}</button></footer><small className="publication-visibility-note">Visible publiquement dans Réalisations. Ne montrez aucune information privée sans autorisation.</small></form>}
        </section>}

        <div className={`facebook-profile-body view-${profileSection}`}>
          <aside className="facebook-about-column">
            {isVerifiedExpert && (profileSection === "overview" || profileSection === "about") && <section className={`facebook-profile-summary-card${profileSection === "about" ? " information-only" : ""}`}>
              <section className="facebook-info-card">
                <header><h2>Informations professionnelles</h2><button onClick={() => go("edit-profile")} aria-label="Modifier les informations"><Pencil aria-hidden="true" /></button></header>
                <p><b><MapPin aria-hidden="true" /></b><span>Travaille à <strong>{expert.area}</strong></span></p>
                <p><b><Map aria-hidden="true" /></b><span>Intervient dans <strong>{coverage}</strong></span></p>
                <p><b><Wrench aria-hidden="true" /></b><span><strong>{expert.trade}</strong> · {expert.experience} an(s) d’expérience</span></p>
                <p><b><Clock aria-hidden="true" /></b><span><strong>{availability}</strong></span></p>
                <p><b><Clock aria-hidden="true" /></b><span>Horaires : <strong>{workingHours}</strong></span></p>
                {workshopAddress && <p><b><Store aria-hidden="true" /></b><span>Atelier : <strong>{workshopAddress}</strong></span></p>}
              </section>
              {profileSection === "overview" && <section className="facebook-reputation-card">
                <button className="facebook-reputation-link" onClick={() => setProfileSection("reviews")} aria-label="Voir tous les avis clients">
                  <b><Star aria-hidden="true" /></b>
                  <span>Recommandé par <strong>{initialData.reviews.length ? `${recommendationRate} %` : "—"}</strong> <small>({initialData.reviews.length} avis)</small></span>
                  <ChevronRight aria-hidden="true" />
                </button>
              </section>}
            </section>}
            {isVerifiedExpert && profileSection === "overview" && <section className="facebook-finance-card compact">
              <button className="facebook-finance-link" onClick={() => go("dashboard")} aria-label="Voir le détail des revenus et commissions">
                <b><Wallet aria-hidden="true" /></b>
                <span><small>Revenus</small><strong>{money(totalRevenue)}</strong></span>
                <ChevronRight aria-hidden="true" />
              </button>
            </section>}
          </aside>

          <div className="facebook-profile-main">
            {isVerifiedExpert && (profileSection === "overview" || profileSection === "posts") && <>
              <section className="facebook-publications-head"><h2>Publications</h2><div><button className={postView === "list" ? "active" : ""} onClick={() => setPostView("list")}>☰ Vue liste</button><button className={postView === "grid" ? "active" : ""} onClick={() => setPostView("grid")}>▦ Vue grille</button></div></section>
              <section className={`facebook-profile-posts ${postView}`}>{posts.map((post) => <article key={post.id}><header>{hasProfilePhoto ? <img src={`/api/expert/profile-photo?v=${profilePhotoVersion}`} alt="" /> : <b>{expert.name.slice(0, 1).toUpperCase()}</b>}<div><strong>{expert.name}<i>✓</i></strong><small>{dateLabel(post.createdAt)} · {post.moderationStatus === "published" ? "Public" : "En vérification"}</small></div><div className="post-owner-actions"><button onClick={() => editPost(post)} aria-label="Modifier la publication">✎</button><button onClick={() => deletePost(post)} aria-label="Supprimer la publication">×</button></div></header><em>{postLabels[post.postType] || "Réalisation"}</em><p>{post.body}</p>{post.requestId ? <div className="facebook-before-after"><figure><img src={`/api/social/images/${post.id}?kind=before`} alt="Avant" /><figcaption>Avant</figcaption></figure><figure><img src={`/api/social/images/${post.id}?kind=after`} alt="Après" /><figcaption>Après</figcaption></figure></div> : post.imageKey && <img className="facebook-post-image" src={`/api/social/images/${post.id}`} alt="Réalisation publiée" />}<footer><span>{post.viewCount} vues · {post.likeCount} j’aime · {post.commentCount} commentaires</span><Link href={`/reseau#publication-${post.id}`}>Voir la publication →</Link></footer>{post.comments.length > 0 && <section className="expert-post-comments">{post.comments.map((comment) => <article key={comment.id}><div><b>{comment.customerName.slice(0,1).toUpperCase()}</b><p><strong>{comment.customerName}</strong>{comment.body}</p></div>{comment.replies.map((reply) => <p className="owner-reply" key={reply.id}><strong>Votre réponse</strong>{reply.body}</p>)}<form onSubmit={(event) => replyComment(event, post.id, comment.id)}><input name="body" maxLength={500} placeholder="Répondre au commentaire…" required /><button disabled={busy === `reply-${comment.id}`}>Répondre</button></form></article>)}</section>}</article>)}{!posts.length && <p className="no-posts">Vos réalisations apparaîtront ici et publiquement dans le réseau.</p>}</section>
            </>}

            {profileSection === "about" && <section className="facebook-detail-card"><header><h2>À propos de {expert.name}</h2><button onClick={() => go("edit-profile")}>✎ Modifier</button></header><h3>Présentation</h3><p>{profileBio || "Ajoutez une courte présentation professionnelle pour expliquer votre spécialité aux clients."}</p><h3>Services et zone</h3><p>{expert.trade} · {expert.experience} an(s) d’expérience</p><p>{coverage}</p><h3>Disponibilité</h3><p>{availability}</p></section>}

            {profileSection === "reviews" && <section className="expert-reviews facebook-reviews-full">
              <header><div><button onClick={() => setProfileSection("overview")}>← Retour au profil</button><span>Réputation</span><h2>Avis clients</h2><p>Notes et commentaires laissés après une intervention.</p></div><div className="reviews-average"><strong>{averageRating}<small>/5</small></strong><span>{"★".repeat(roundedRating)}{"☆".repeat(5 - roundedRating)}</span></div></header>
              {initialData.reviews.map((review) => <article key={review.id}><header className="review-author"><b>{review.customerName.slice(0, 1).toUpperCase()}</b><div><strong>{review.customerName}</strong><small>{dateLabel(review.createdAt)}</small></div><span>{"★".repeat(review.rating || 0)}{"☆".repeat(5 - (review.rating || 0))}</span></header><p>{review.details}</p></article>)}
              {!initialData.reviews.length && <div className="no-reviews"><b>☆</b><strong>Aucun avis pour le moment</strong><p>Les notes apparaîtront ici après vos interventions terminées.</p></div>}
            </section>}
          </div>
        </div>
      </section>}

      {tab === "support" && <section className="expert-support"><article><b>?</b><span>Assistance</span><h2>Besoin d’aide sur une mission ?</h2><p>Contactez l’administration en indiquant le numéro de la demande. Ne partagez jamais votre numéro d’accès avec un client.</p><Link href="/contact">Contacter le service →</Link></article><article><b>⚑</b><span>Sécurité</span><h2>Signaler un problème</h2><p>Utilisez la procédure de plainte en cas de comportement dangereux, de désaccord grave ou de tentative de fraude.</p><Link href="/procedure-plainte">Ouvrir la procédure →</Link></article><article><b>✓</b><span>Bonnes pratiques</span><h2>Règles professionnelles</h2><p>Annoncez le prix avant le travail, respectez les horaires, protégez les données du client et photographiez seulement avec son accord.</p><Link href="/regles-experts">Lire les règles →</Link></article><button onClick={signOut}>Se déconnecter de cet appareil</button></section>}
    </section>
    {tab === "profile" && <AppBottomNav active="profile" />}

      {profileMediaOpen && (
        <ProfileMediaModal
          kind={profileMediaOpen}
          open={true}
          hasImage={
            profileMediaOpen === "profile"
              ? hasProfilePhoto
              : hasCoverPhoto
          }
          imageUrl={
            profileMediaOpen === "profile"
              ? hasProfilePhoto
                ? `/api/expert/profile-photo?v=${profilePhotoVersion}`
                : null
              : hasCoverPhoto
                ? `/api/expert/cover-photo?v=${coverPhotoVersion}`
                : null
          }
          onClose={() => setProfileMediaOpen(null)}
          onChanged={(exists) => {
            if (profileMediaOpen === "profile") {
              setHasProfilePhoto(exists);
              setProfilePhotoVersion(Date.now());
            } else {
              setHasCoverPhoto(exists);
              setCoverPhotoVersion(Date.now());
            }
          }}
          onNotice={setNotice}
        />
      )}</main>;
}
