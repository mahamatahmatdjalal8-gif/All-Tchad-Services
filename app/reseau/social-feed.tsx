"use client";

import { Bookmark, Heart, MessageCircle, Share2, Flag } from "lucide-react";
import PostPhoto from "./post-photo";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Expert = { id: number; name: string; trade: string; area: string; coverage: string; experience: number; availability: string; followerCount: number; followingCount?: number; hasProfilePhoto?: boolean };
type Comment = { id: number; body: string; customerName: string; createdAt: string; replies?: { id: number; body: string; createdAt: string }[] };
type Post = { id: number; expertId: number; requestId: number | null; postType: string; body: string; imageKey: string | null; createdAt: string; expert: Expert; likeCount: number; favoriteCount: number; shareCount: number; viewCount: number; comments: Comment[] };
export type SocialData = { posts: Post[]; experts: Expert[] };

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function dateLabel(value: string) { return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function visitorKey() {
  try {
    const saved = window.localStorage.getItem("ats_social_visitor_key");
    if (saved) return saved;
    const created = crypto.randomUUID().replaceAll("-", "");
    window.localStorage.setItem("ats_social_visitor_key", created);
    return created;
  } catch {
    return `visitor_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

export default function SocialFeed({ initialData, query = "", mode = "network" }: { initialData?: SocialData; query?: string; mode?: "network" | "home" | "profile" }) {
  const [posts, setPosts] = useState(initialData?.posts ?? []);
  const [experts, setExperts] = useState(initialData?.experts ?? []);
  const [loadingFeed, setLoadingFeed] = useState(!initialData);
  const [authenticated, setAuthenticated] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [currentExpertId, setCurrentExpertId] = useState<number | null>(null);
  const [liked, setLiked] = useState<number[]>([]);
  const [followed, setFollowed] = useState<number[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [favoritePosts, setFavoritePosts] = useState<number[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [busy, setBusy] = useState("");
  const [commentPost, setCommentPost] = useState<number | null>(null);
  const [visiblePostCount, setVisiblePostCount] = useState(3);
  const trackedViews = useRef(new Set<number>());

  async function trackTraffic(action: "view" | "share", postId: number) {
    const response = await fetch("/api/social/traffic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, postId, visitorKey: visitorKey() }) });
    if (!response.ok) return null;
    return response.json() as Promise<{ ok: boolean; count: number }>;
  }

  useEffect(() => {
    let active = true;
    fetch("/api/social/me").then((response) => response.json()).then((data) => {
      if (!active) return;
      setAuthenticated(Boolean(data.authenticated));
      setCustomerName(data.customerName ?? "");
      setCurrentExpertId(data.expertId ?? null);
      setLiked(data.likedPostIds ?? []);
      setFavoritePosts(data.favoritePostIds ?? []);
      setFollowed(data.followedExpertIds ?? []);
      setFavorites(data.favoriteExpertIds ?? []);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (initialData) return;
    let active = true;
    fetch("/api/social/feed").then((response) => response.json()).then((data: SocialData) => {
      if (!active) return;
      setPosts(data.posts ?? []);
      setExperts(data.experts ?? []);
      setLoadingFeed(false);
    }).catch(() => { if (active) setLoadingFeed(false); });
    return () => { active = false; };
  }, [initialData]);

  const filteredPosts = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matching = !term ? posts : posts.filter((post) => [post.body, post.expert.name, post.expert.trade, post.expert.area, post.expert.coverage].join(" ").toLowerCase().includes(term));
    return [...matching].sort((a, b) => Number(followed.includes(b.expertId)) - Number(followed.includes(a.expertId)) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [posts, query, followed]);

  const filteredExperts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return !term ? experts : experts.filter((expert) => [expert.name, expert.trade, expert.area, expert.coverage].join(" ").toLowerCase().includes(term));
  }, [experts, query]);

  useEffect(() => {
    filteredPosts.slice(0, visiblePostCount).forEach((post) => {
      if (trackedViews.current.has(post.id)) return;
      trackedViews.current.add(post.id);
      trackTraffic("view", post.id).then((result) => {
        if (!result) return;
        setPosts((current) => current.some((item) => item.id === post.id && item.viewCount !== result.count)
          ? current.map((item) => item.id === post.id ? { ...item, viewCount: result.count } : item)
          : current);
      });
    });
  }, [filteredPosts, visiblePostCount]);

  function requireIdentity() {
    if (authenticated) return true;
    setShowAuth(true);
    return false;
  }

  async function interact(action: string, payload: Record<string, unknown>) {
    if (!requireIdentity()) return null;
    const response = await fetch("/api/social/interact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) setShowAuth(true);
      return null;
    }
    return result;
  }

  async function toggleLike(postId: number) {
    const result = await interact("like", { postId });
    if (!result) return;
    setLiked((current) => result.active ? [...current, postId] : current.filter((id) => id !== postId));
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, likeCount: post.likeCount + (result.active ? 1 : -1) } : post));
  }

  async function togglePostFavorite(postId: number) {
    const result = await interact("favorite-post", { postId });
    if (!result) return;
    setFavoritePosts((current) => result.active ? [...current, postId] : current.filter((id) => id !== postId));
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, favoriteCount: Math.max(0, post.favoriteCount + (result.active ? 1 : -1)) } : post));
  }

  async function toggleRelation(expertId: number, type: "follow" | "favorite") {
    const result = await interact(type, { expertId });
    if (!result) return;
    const setter = type === "follow" ? setFollowed : setFavorites;
    setter((current) => result.active ? [...current, expertId] : current.filter((id) => id !== expertId));
  }

  async function addComment(event: FormEvent<HTMLFormElement>, postId: number) {
    event.preventDefault();
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "");
    setBusy(`comment-${postId}`);
    const result = await interact("comment", { postId, content });
    setBusy("");
    if (!result?.comment) return;
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, comments: [...post.comments, result.comment] } : post));
    form.reset();
  }

  async function sharePost(post: Post) {
    const url = `${window.location.origin}/#publication-${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.expert.name} · Allô Tchad`, text: post.body, url });
      else await navigator.clipboard.writeText(url);
      const result = await trackTraffic("share", post.id);
      if (result) setPosts((current) => current.map((item) => item.id === post.id ? { ...item, shareCount: result.count } : item));
      setBusy(`shared-${post.id}`);
      window.setTimeout(() => setBusy(""), 1800);
    } catch { /* Un partage annulé n’est pas comptabilisé. */ }
  }

  async function reportPost(postId: number) {
    if (!requireIdentity()) return;
    const reason = window.prompt("Pourquoi signalez-vous cette publication ?");
    if (!reason) return;
    setBusy(`report-${postId}`);
    const result = await interact("report-post", { postId, reason });
    setBusy(result?.ok ? `reported-${postId}` : "");
    window.setTimeout(() => setBusy(""), 1800);
  }

  return <>
    <div className={`network-layout ${mode === "profile" ? "profile-mode" : ""}`}>
      <aside className="network-sidebar">
        <div className={`client-card ${authenticated ? "client-card-connected" : ""}`}><b aria-hidden="true">{authenticated ? "✓" : "♙"}</b><div><span>{authenticated ? `Bonjour ${customerName}` : "Espace professionnel"}</span><p>{authenticated ? "Votre compte expert est connecté : suivez, commentez et gardez vos contacts." : "Connectez votre compte expert pour participer au réseau et contacter d’autres professionnels."}</p></div>{authenticated ? <a href="/espace-expert?tab=profile">Ouvrir mon profil <i>→</i></a> : <button onClick={() => setShowAuth(true)}>Me connecter <i>→</i></button>}</div>
      </aside>

      <section className="feed-column">
        {filteredPosts.slice(0, visiblePostCount).map((post) => <article className="social-post realization-card" id={`publication-${post.id}`} key={post.id}>
          <header><a className="expert-avatar" href={`/experts/${post.expert.id}`}>{post.expert.hasProfilePhoto ? <img src={`/api/expert/profile-photo?id=${post.expert.id}`} alt={`Photo de ${post.expert.name}`} /> : initials(post.expert.name)}</a><div><a className="post-expert-name" href={`/experts/${post.expert.id}`}>{post.expert.name}<i>✓</i></a><span>{post.expert.trade} · {post.expert.area}</span><small>{dateLabel(post.createdAt)}</small></div><div className="post-expert-actions">{currentExpertId !== post.expertId && <button className={followed.includes(post.expertId) ? "following" : ""} onClick={() => toggleRelation(post.expertId, "follow")}>{followed.includes(post.expertId) ? "Abonné ✓" : "+ Suivre"}</button>}<button className={favorites.includes(post.expertId) ? "saved" : ""} onClick={() => toggleRelation(post.expertId, "favorite")} aria-label="Enregistrer cet expert">{favorites.includes(post.expertId) ? "★" : "☆"}</button></div></header>
          <span className={`post-kind post-kind-${post.postType || "work"}`}>{({ work: "Réalisation", "before-after": "Avant / après", available: "Disponible", tip: "Conseil", offer: "Offre de service" } as Record<string, string>)[post.postType] || "Réalisation"}</span><p>{post.body}</p>
          {post.requestId ? <div className="before-after-gallery"><figure><img src={`/api/social/images/${post.id}?kind=before`} alt={`Avant l’intervention de ${post.expert.name}`} /><figcaption>Avant</figcaption></figure><figure><img src={`/api/social/images/${post.id}?kind=after`} alt={`Après l’intervention de ${post.expert.name}`} /><figcaption>Après</figcaption></figure></div> : post.imageKey && <PostPhoto src={`/api/social/images/${post.id}`} alt={`Travail réalisé par ${post.expert.name}`} />}
          <div className="post-stats"><span>{post.viewCount} vue{post.viewCount > 1 ? "s" : ""}</span><span>{post.likeCount} j’aime · {post.comments.length} commentaire{post.comments.length > 1 ? "s" : ""} · {post.shareCount} partage{post.shareCount > 1 ? "s" : ""}</span></div>
          <div className="post-actions"><button aria-pressed={liked.includes(post.id)} className={liked.includes(post.id) ? "active" : ""} onClick={() => toggleLike(post.id)}><Heart aria-hidden="true" /><span>J’aime</span></button><button aria-expanded={commentPost === post.id} onClick={() => { if (requireIdentity()) setCommentPost(commentPost === post.id ? null : post.id); }}><MessageCircle aria-hidden="true" /><span>Commenter</span></button><button onClick={() => sharePost(post)}><Share2 aria-hidden="true" /><span>{busy === `shared-${post.id}` ? "Partagé" : "Partager"}</span></button></div>
          <div className="post-secondary-actions"><button aria-pressed={favoritePosts.includes(post.id)} onClick={() => togglePostFavorite(post.id)}><Bookmark aria-hidden="true" />{favoritePosts.includes(post.id) ? "Enregistré" : "Enregistrer"}</button><button onClick={() => reportPost(post.id)}><Flag aria-hidden="true" />{busy === `reported-${post.id}` ? "Signalé" : "Signaler"}</button></div>
          {currentExpertId !== post.expertId && <a className="post-contact" href={`/experts/${post.expert.id}?demande=1`}><MessageCircle aria-hidden="true" />Contacter cet expert</a>}
          {post.comments.length > 0 && <div className="comments-list">{post.comments.map((comment) => <div key={comment.id}><b>{comment.customerName.slice(0, 1).toUpperCase()}</b><p><strong>{comment.customerName}</strong>{comment.body}{comment.replies?.map((reply) => <span className="expert-comment-reply" key={reply.id}><b>Réponse de l’expert</b>{reply.body}</span>)}</p></div>)}</div>}
          {commentPost === post.id && <form className="comment-form" onSubmit={(event) => addComment(event, post.id)}><span>{customerName.slice(0, 1).toUpperCase()}</span><input name="content" maxLength={500} placeholder="Écrire un commentaire…" required /><button disabled={busy === `comment-${post.id}`}>Envoyer</button></form>}
        </article>)}
        {visiblePostCount < filteredPosts.length && <button className="load-more-posts" type="button" onClick={() => setVisiblePostCount((count) => count + 3)}>Voir plus de publications</button>}
        {loadingFeed && <div className="empty-feed"><span>●</span><h2>Chargement du réseau…</h2><p>Nous préparons les profils et les réalisations.</p></div>}
        {!loadingFeed && !filteredPosts.length && <div className="empty-feed"><span>⌕</span><h2>Aucune publication trouvée</h2><p>Essayez un autre métier ou quartier.</p></div>}
      </section>

      <aside className={`expert-rail ${mode === "home" ? "home-expert-rail" : ""}`}><header><span>{mode === "home" ? "Experts disponibles" : "Experts à découvrir"}</span><small>{filteredExperts.length} profils</small></header>{filteredExperts.slice(0, 4).map((expert) => <article key={expert.id}><a className="expert-avatar" href={`/experts/${expert.id}`}>{expert.hasProfilePhoto ? <img src={`/api/expert/profile-photo?id=${expert.id}`} alt={`Photo de ${expert.name}`} /> : initials(expert.name)}</a><div><a className="rail-expert-name" href={`/experts/${expert.id}`}>{expert.name}<i>✓</i></a><span>{expert.trade}</span><small>{expert.followerCount} abonné{expert.followerCount > 1 ? "s" : ""} · {expert.area}</small>{mode === "home" && <em className={expert.availability.toLowerCase().includes("indisponible") ? "unavailable" : ""}>● {expert.availability}</em>}</div><div className="expert-buttons">{currentExpertId !== expert.id && <button className={followed.includes(expert.id) ? "active" : ""} onClick={() => toggleRelation(expert.id, "follow")}>{followed.includes(expert.id) ? "Abonné ✓" : "+ Suivre"}</button>}<a href={`/experts/${expert.id}`}>Profil</a><button className={favorites.includes(expert.id) ? "active" : ""} onClick={() => toggleRelation(expert.id, "favorite")} aria-label="Ajouter aux favoris">{favorites.includes(expert.id) ? "★" : "☆"}</button></div></article>)}<a className="all-experts-link" href="/experts">Voir tous les experts →</a></aside>
    </div>

    {showAuth && <div className="social-modal" onMouseDown={(event) => event.target === event.currentTarget && setShowAuth(false)}><section className="expert-login-dialog" role="dialog" aria-modal="true" aria-label="Connexion expert"><button type="button" onClick={() => setShowAuth(false)} aria-label="Fermer">×</button><span>Participer au réseau</span><h2>Connectez votre compte expert</h2><p>La connexion professionnelle permet de suivre, commenter, enregistrer et contacter les autres experts.</p><a className="expert-social-login" href="/profil">Accéder à mon compte expert →</a></section></div>}
  </>;
}
