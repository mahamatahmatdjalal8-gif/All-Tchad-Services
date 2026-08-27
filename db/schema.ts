import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id"),
    requesterExpertId: integer("requester_expert_id").references(() => artisanApplications.id, { onDelete: "set null" }),
    targetExpertId: integer("target_expert_id").references(() => artisanApplications.id, { onDelete: "set null" }),
    requestKind: text("request_kind").notNull().default("service"),
    reference: text("reference").notNull().unique(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    service: text("service").notNull(),
    city: text("city").notNull(),
    district: text("district").notNull(),
    urgency: text("urgency").notNull(),
    details: text("details").notNull(),
    accessCodeHash: text("access_code_hash"),
    failedAccessAttempts: integer("failed_access_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("new"),
    assignedArtisan: text("assigned_artisan"),
    expertDecision: text("expert_decision").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    quoteAmount: integer("quote_amount").notNull().default(0),
    laborAmount: integer("labor_amount").notNull().default(0),
    materialAmount: integer("material_amount").notNull().default(0),
    quoteDetails: text("quote_details"),
    quoteStatus: text("quote_status").notNull().default("not_sent"),
    scheduledFor: text("scheduled_for"),
    clientRequestedFor: text("client_requested_for"),
    materialsNeeded: text("materials_needed"),
    cancellationReason: text("cancellation_reason"),
    arrivedAt: timestamp("arrived_at", { withTimezone: true, mode: "date" }),
    problemImageKey: text("problem_image_key"),
    problemImageContentType: text("problem_image_content_type"),
    problemImageSize: integer("problem_image_size"),
    locationLat: text("location_lat"),
    locationLng: text("location_lng"),
    beforeImageKey: text("before_image_key"),
    beforeImageContentType: text("before_image_content_type"),
    beforeImageSize: integer("before_image_size"),
    afterImageKey: text("after_image_key"),
    afterImageContentType: text("after_image_content_type"),
    afterImageSize: integer("after_image_size"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    commissionAmount: integer("commission_amount").notNull().default(0),
    commissionStatus: text("commission_status").notNull().default("not_applicable"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("service_requests_status_idx").on(table.status),
    index("service_requests_account_idx").on(table.accountId),
    index("service_requests_requester_expert_idx").on(table.requesterExpertId),
    index("service_requests_target_expert_idx").on(table.targetExpertId),
    index("service_requests_created_at_idx").on(table.createdAt),
  ],
);

export const artisanApplications = pgTable(
  "artisan_applications",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id"),
    reference: text("reference").notNull().unique(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    loginEmail: text("login_email"),
    trade: text("trade").notNull(),
    area: text("area").notNull(),
    coverage: text("coverage").notNull(),
    experience: integer("experience").notNull(),
    availability: text("availability").notNull(),
    proof: text("proof").notNull(),
    workExamples: text("work_examples").notNull(),
    identityType: text("identity_type"),
    identityNumber: text("identity_number"),
    workshopAddress: text("workshop_address"),
    workingHours: text("working_hours"),
    accessCodeHash: text("access_code_hash"),
    failedAccessAttempts: integer("failed_access_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
    profileBio: text("profile_bio"),
    profileImageKey: text("profile_image_key"),
    profileImageContentType: text("profile_image_content_type"),
    profileImageSize: integer("profile_image_size"),
    coverImageKey: text("cover_image_key"),
    coverImageContentType: text("cover_image_content_type"),
    coverImageSize: integer("cover_image_size"),
    referenceOneName: text("reference_one_name"),
    referenceOnePhone: text("reference_one_phone"),
    referenceTwoName: text("reference_two_name"),
    referenceTwoPhone: text("reference_two_phone"),
    status: text("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("artisan_applications_status_idx").on(table.status),
    uniqueIndex("artisan_applications_account_unique_idx").on(table.accountId),
    index("artisan_applications_created_at_idx").on(table.createdAt),
  ],
);

export const artisanDocuments = pgTable(
  "artisan_documents",
  {
    id: serial("id").primaryKey(),
    applicationId: integer("application_id").notNull().references(() => artisanApplications.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("artisan_documents_application_idx").on(table.applicationId),
    index("artisan_documents_kind_idx").on(table.kind),
  ],
);

export const feedbackEntries = pgTable(
  "feedback_entries",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    requestReference: text("request_reference"),
    kind: text("kind").notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    rating: integer("rating"),
    details: text("details").notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("feedback_entries_status_idx").on(table.status),
    index("feedback_entries_kind_idx").on(table.kind),
  ],
);

export const expertPosts = pgTable(
  "expert_posts",
  {
    id: serial("id").primaryKey(),
    expertId: integer("expert_id").notNull().references(() => artisanApplications.id, { onDelete: "cascade" }),
    requestId: integer("request_id").references(() => serviceRequests.id, { onDelete: "cascade" }),
    postType: text("post_type").notNull().default("work"),
    body: text("body").notNull(),
    imageKey: text("image_key"),
    imageContentType: text("image_content_type"),
    imageSize: integer("image_size"),
    moderationStatus: text("moderation_status").notNull().default("published"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("expert_posts_expert_idx").on(table.expertId), index("expert_posts_created_at_idx").on(table.createdAt), uniqueIndex("expert_posts_request_unique_idx").on(table.requestId)],
);

export const clientSessions = pgTable(
  "client_sessions",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("client_sessions_request_idx").on(table.requestId)],
);

export const personalAccounts = pgTable(
  "personal_accounts",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull().unique(),
    city: text("city").notNull().default("N’Djamena"),
    passwordHash: text("password_hash").notNull(),
    socialSessionId: integer("social_session_id").references(() => clientSessions.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("personal_accounts_phone_idx").on(table.phone), index("personal_accounts_social_session_idx").on(table.socialSessionId)],
);

export const personalSessions = pgTable(
  "personal_sessions",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id").notNull().references(() => personalAccounts.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("personal_sessions_account_idx").on(table.accountId)],
);

export const postLikes = pgTable(
  "post_likes",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => expertPosts.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => clientSessions.id, { onDelete: "cascade" }),
    expertId: integer("expert_id").references(() => artisanApplications.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("post_likes_unique_idx").on(table.postId, table.sessionId), uniqueIndex("post_likes_expert_unique_idx").on(table.postId, table.expertId), index("post_likes_post_idx").on(table.postId), index("post_likes_session_idx").on(table.sessionId), index("post_likes_expert_idx").on(table.expertId)],
);

export const postComments = pgTable(
  "post_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => expertPosts.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => clientSessions.id, { onDelete: "cascade" }),
    expertId: integer("expert_id").references(() => artisanApplications.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("post_comments_post_idx").on(table.postId), index("post_comments_session_idx").on(table.sessionId), index("post_comments_expert_idx").on(table.expertId)],
);

export const postFavorites = pgTable(
  "post_favorites",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => expertPosts.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => clientSessions.id, { onDelete: "cascade" }),
    expertId: integer("expert_id").references(() => artisanApplications.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("post_favorites_unique_idx").on(table.postId, table.sessionId), uniqueIndex("post_favorites_expert_unique_idx").on(table.postId, table.expertId), index("post_favorites_post_idx").on(table.postId), index("post_favorites_session_idx").on(table.sessionId), index("post_favorites_expert_idx").on(table.expertId)],
);

export const postViews = pgTable(
  "post_views",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => expertPosts.id, { onDelete: "cascade" }),
    visitorKey: text("visitor_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("post_views_unique_idx").on(table.postId, table.visitorKey), index("post_views_post_idx").on(table.postId)],
);

export const postShares = pgTable(
  "post_shares",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => expertPosts.id, { onDelete: "cascade" }),
    visitorKey: text("visitor_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("post_shares_unique_idx").on(table.postId, table.visitorKey), index("post_shares_post_idx").on(table.postId), index("post_shares_created_at_idx").on(table.createdAt)],
);

export const expertRelationships = pgTable(
  "expert_relationships",
  {
    id: serial("id").primaryKey(),
    expertId: integer("expert_id").notNull().references(() => artisanApplications.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => clientSessions.id, { onDelete: "cascade" }),
    followerExpertId: integer("follower_expert_id").references(() => artisanApplications.id, { onDelete: "cascade" }),
    follows: boolean("follows").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("expert_relationships_unique_idx").on(table.expertId, table.sessionId), uniqueIndex("expert_relationships_expert_actor_unique_idx").on(table.expertId, table.followerExpertId), index("expert_relationships_expert_idx").on(table.expertId), index("expert_relationships_session_idx").on(table.sessionId), index("expert_relationships_follower_expert_idx").on(table.followerExpertId)],
);

export const requestMessages = pgTable(
  "request_messages",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").notNull().references(() => serviceRequests.id, { onDelete: "cascade" }),
    senderExpertId: integer("sender_expert_id").references(() => artisanApplications.id, { onDelete: "set null" }),
    senderType: text("sender_type").notNull(),
    senderName: text("sender_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("request_messages_request_idx").on(table.requestId), index("request_messages_sender_expert_idx").on(table.senderExpertId), index("request_messages_created_at_idx").on(table.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id").references(() => serviceRequests.id, { onDelete: "cascade" }),
    recipientType: text("recipient_type").notNull(),
    recipientId: integer("recipient_id").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("notifications_recipient_idx").on(table.recipientType, table.recipientId), index("notifications_request_idx").on(table.requestId), index("notifications_created_at_idx").on(table.createdAt)],
);

export const postReplies = pgTable(
  "post_replies",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id").notNull().references(() => postComments.id, { onDelete: "cascade" }),
    expertId: integer("expert_id").notNull().references(() => artisanApplications.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("post_replies_comment_idx").on(table.commentId), index("post_replies_expert_idx").on(table.expertId)],
);

export const postReports = pgTable(
  "post_reports",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull().references(() => expertPosts.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => clientSessions.id, { onDelete: "cascade" }),
    expertId: integer("expert_id").references(() => artisanApplications.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("post_reports_unique_idx").on(table.postId, table.sessionId), uniqueIndex("post_reports_expert_unique_idx").on(table.postId, table.expertId), index("post_reports_post_idx").on(table.postId), index("post_reports_session_idx").on(table.sessionId), index("post_reports_expert_idx").on(table.expertId)],
);

export const expertCredentials = pgTable(
  "expert_credentials",
  {
    id: serial("id").primaryKey(),
    expertId: integer("expert_id").notNull().references(() => artisanApplications.id, { onDelete: "cascade" }).unique(),
    email: text("email").notNull().unique(),
    codeHash: text("code_hash").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("expert_credentials_email_idx").on(table.email)],
);

export const expertSessions = pgTable(
  "expert_sessions",
  {
    id: serial("id").primaryKey(),
    expertId: integer("expert_id").notNull().references(() => artisanApplications.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("expert_sessions_expert_idx").on(table.expertId)],
);
