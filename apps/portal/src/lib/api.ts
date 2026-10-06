import type { Portal } from "./portal";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: Record<string, unknown> } | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthUser = {
  id: string;
  role: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
};

export type AuthResponse = {
  tokens: AuthTokens;
  user: AuthUser;
};

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    /** HTTP status when there was a response; undefined when the request
     * never reached the server. */
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const NETWORK_ERROR_MESSAGE =
  "Can't reach the server. Check your connection and try again.";
const SERVER_UNAVAILABLE_MESSAGE =
  "The server is temporarily unavailable. Please try again in a moment.";

/** fetch + JSON parse that never throws a raw TypeError/SyntaxError: no
 * network becomes NETWORK_ERROR, and a non-JSON reply (a proxy's 502 HTML
 * page, say) comes back as `body: null` for the caller to classify. */
async function sendRequest(
  url: string,
  init: RequestInit,
): Promise<{ res: Response; body: ApiEnvelope<unknown> | null }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError("NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }
  let body: ApiEnvelope<unknown> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<unknown>;
  } catch {
    body = null;
  }
  return { res, body };
}

function toApiError(res: Response, body: ApiEnvelope<unknown> | null): ApiError {
  if (!body || typeof body !== "object" || !("success" in body)) {
    return res.status >= 500
      ? new ApiError("SERVER_UNAVAILABLE", SERVER_UNAVAILABLE_MESSAGE, res.status)
      : new ApiError("INTERNAL_ERROR", `Request failed (HTTP ${res.status})`, res.status);
  }
  return new ApiError(
    body.error?.code ?? "INTERNAL_ERROR",
    body.error?.message ?? "Request failed",
    res.status,
  );
}

type ApiAuthHandlers = {
  getRefreshToken: () => string | null;
  onSessionRefreshed: (session: AuthResponse) => void;
  onSessionExpired: () => void;
};

/** Only a real refusal from the server ends the session. A dropped
 * connection or a server hiccup during the refresh says nothing about the
 * token, so the user stays signed in (and keeps any unsaved work). */
type RefreshOutcome =
  | { kind: "refreshed"; accessToken: string }
  | { kind: "expired" }
  | { kind: "unavailable" };

let apiAuthHandlers: ApiAuthHandlers | null = null;
let refreshInFlight: Promise<RefreshOutcome> | null = null;

export function registerApiAuthHandlers(handlers: ApiAuthHandlers): void {
  apiAuthHandlers = handlers;
}

async function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!apiAuthHandlers) return { kind: "expired" };

  if (!refreshInFlight) {
    refreshInFlight = (async (): Promise<RefreshOutcome> => {
      const refreshToken = apiAuthHandlers!.getRefreshToken();
      if (!refreshToken) {
        apiAuthHandlers!.onSessionExpired();
        return { kind: "expired" };
      }

      try {
        const { res, body } = await sendRequest(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const session = (body as ApiEnvelope<AuthResponse> | null)?.data;
        if (res.ok && body?.success && session) {
          apiAuthHandlers!.onSessionRefreshed(session);
          return { kind: "refreshed", accessToken: session.tokens.accessToken };
        }
        // The server answered and refused the refresh token: that's a real
        // expiry. Anything else — 5xx, a proxy page, 429 rate limiting — is
        // temporary and must not sign the user out.
        if (body && (res.status === 400 || res.status === 401 || res.status === 403)) {
          apiAuthHandlers!.onSessionExpired();
          return { kind: "expired" };
        }
        return { kind: "unavailable" };
      } catch {
        return { kind: "unavailable" };
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

type AuthedFetchOptions = RequestInit & {
  accessToken?: string;
  json?: boolean;
  _retried?: boolean;
};

async function authedFetch<T>(
  path: string,
  options: AuthedFetchOptions = {},
): Promise<T> {
  const { accessToken, json = true, _retried, ...init } = options;
  const headers = new Headers(init.headers);
  if (json) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const { res, body } = await sendRequest(`${API_BASE}${path}`, { ...init, headers });

  if (
    res.status === 401 &&
    body?.error?.code === "UNAUTHORIZED" &&
    accessToken &&
    !_retried &&
    apiAuthHandlers
  ) {
    const outcome = await refreshAccessToken();
    if (outcome.kind === "refreshed") {
      return authedFetch<T>(path, {
        ...options,
        accessToken: outcome.accessToken,
        _retried: true,
      });
    }
    if (outcome.kind === "unavailable") {
      throw new ApiError(
        "NETWORK_ERROR",
        "Couldn't refresh your session — check your connection and try again. You're still signed in.",
      );
    }
    throw new ApiError("UNAUTHORIZED", "Your session expired. Please log in again.", 401);
  }

  if (!res.ok || !body?.success || body.data === null) {
    throw toApiError(res, body);
  }

  return body.data as T;
}

export async function apiFetchPublic<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { res, body } = await sendRequest(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok || !body?.success || body.data === null) {
    throw toApiError(res, body);
  }
  return body.data as T;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  return authedFetch<T>(path, options);
}

export async function apiFetchForm<T>(
  path: string,
  options: Omit<RequestInit, "body"> & { body: FormData; accessToken?: string },
): Promise<T> {
  const { accessToken, ...init } = options;
  return authedFetch<T>(path, {
    ...init,
    accessToken,
    json: false,
    body: options.body,
  });
}

export type DirectUploadPurpose =
  | "campaign-cover"
  | "campaign-asset"
  | "campaign-source"
  | "brand-logo"
  | "admin-brand-logo"
  | "avatar"
  | "admin-draft-copy";

export type DirectUploadResult = {
  url: string;
  path: string;
  name: string;
  type: "image" | "video";
  contentType: string;
};

/**
 * Every file a brand/staff/admin uploads goes browser → R2 directly:
 *  1. the API signs a PUT for this exact file (type + byte size),
 *  2. the browser sends the bytes straight to storage,
 *  3. the API checks the first few KB and moves it into place.
 * The file never passes through the API server. `legacy` is only used when
 * the server has no object storage (local development).
 */
async function uploadDirect<T extends object = object>(
  token: string,
  file: File,
  purpose: DirectUploadPurpose,
  opts: { deliverableId?: string; legacy?: () => Promise<DirectUploadResult & T> } = {},
): Promise<DirectUploadResult & T> {
  let presign: { uploadId: string; uploadUrl: string; headers: Record<string, string> };
  try {
    presign = await apiFetch("/uploads/direct/presign", {
      method: "POST",
      accessToken: token,
      body: JSON.stringify({
        purpose,
        contentType: file.type,
        size: file.size,
        fileName: file.name,
        deliverableId: opts.deliverableId,
      }),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "DIRECT_UPLOAD_UNAVAILABLE" && opts.legacy) {
      return opts.legacy();
    }
    throw error;
  }

  let putRes: Response;
  try {
    putRes = await fetch(presign.uploadUrl, { method: "PUT", body: file, headers: presign.headers });
  } catch {
    throw new ApiError("NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }
  if (!putRes.ok) {
    throw new ApiError("UPLOAD_FAILED", `Upload to storage failed (HTTP ${putRes.status}) — please try again.`, putRes.status);
  }

  return apiFetch<DirectUploadResult & T>("/uploads/direct/complete", {
    method: "POST",
    accessToken: token,
    body: JSON.stringify({ uploadId: presign.uploadId }),
  });
}

const asResult = (r: { url: string; path?: string; name?: string; type?: "image" | "video" }, file: File): DirectUploadResult => ({
  url: r.url,
  path: r.path ?? r.url,
  name: r.name ?? file.name,
  type: r.type ?? (file.type.startsWith("video/") ? "video" : "image"),
  contentType: file.type,
});

function legacyForm<T>(path: string, token: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  return apiFetchForm<T>(path, { method: "POST", accessToken: token, body: form });
}

type RegisterPayload = {
  email: string;
  password: string;
  companyName: string;
  displayName?: string;
  acceptTerms: true;
};

export type PublicReferenceAsset = { type: "image" | "video"; url: string; label?: string };
export type PublicSourceAsset = { type: "drive" | "youtube"; url: string; label?: string };

export type PublicCampaign = {
  id: string;
  title: string;
  category: string | null;
  platform: string;
  platforms: string[];
  locationType: "pan_india" | "states";
  targetStates: string[];
  status: string;
  brief: string;
  briefHook: string | null;
  doRules: string | null;
  avoidRules: string | null;
  sourceAssets: PublicSourceAsset[] | null;
  referenceAssets: PublicReferenceAsset[] | null;
  coverImageUrl: string | null;
  productUrl: string | null;
  startDate: string | null;
  brandCompanyName: string | null;
  brandLogoUrl: string | null;
};

export type PublicDeliverableListItem = {
  id: string;
  platform: string;
  status: string;
  draftDriveUrl: string | null;
  livePostUrl: string | null;
  rejectionReason: string | null;
  draftSubmittedAt: string | null;
  participationId: string;
  joinedAt: string;
  creatorName: string;
  priorRejectionCount: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  estimatedPaise: number;
  siblingDeliverables: Array<{ id: string; platform: string; status: string }>;
};

export const publicApi = {
  campaign: (id: string) =>
    apiFetchPublic<PublicCampaign>(`/public/campaigns/${id}`),
  deliverables: (id: string) =>
    apiFetchPublic<PublicDeliverableListItem[]>(`/public/campaigns/${id}/deliverables`),
};

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiFetch<AuthResponse>("/auth/brand/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (portal: Portal, payload: { email: string; password: string }) =>
    apiFetch<AuthResponse>(`/auth/${portal}/login`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  forgotPassword: (email: string) =>
    apiFetch<{ sent: boolean }>("/auth/brand/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { token: string; password: string }) =>
    apiFetch<{ reset: boolean }>("/auth/brand/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  refresh: (refreshToken: string) =>
    apiFetch<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }),

  previewCampaignInvite: (token: string) =>
    apiFetchPublic<{
      valid: boolean;
      expired: boolean;
      alreadyAccepted: boolean;
      campaignId: string | null;
      campaignTitle: string | null;
      email: string | null;
      needsSignup: boolean;
      hasBrandAccount: boolean;
    }>(`/auth/campaign-invite/preview?token=${encodeURIComponent(token)}`),

  acceptCampaignInvite: (payload: {
    token: string;
    password?: string;
    displayName?: string;
    companyName?: string;
  }) =>
    apiFetchPublic<
      | AuthResponse & { campaign: Campaign }
      | { needsSignup: true }
    >("/auth/campaign-invite/accept", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type Campaign = {
  id: string;
  brandProfileId: string | null;
  ownership: "brand_created" | "admin_created";
  wizardStep: "basics" | "brief" | "payout" | "review";
  inviteAcceptedAt: string | null;
  title: string;
  category: string | null;
  platform: string;
  platforms: string[];
  locationType: "pan_india" | "states";
  targetStates: string[];
  status: string;
  brief: string;
  briefHook: string | null;
  doRules: string | null;
  avoidRules: string | null;
  sourceAssets: Array<{ type: "drive" | "youtube" | "upload"; url: string; label?: string }> | null;
  sourceVideoRequirement: "mandatory" | "optional" | "not_required";
  sourceAudioRequirement: "mandatory" | "optional" | "not_required";
  autoReviewEnabled: boolean;
  referenceAssets: Array<{ type: "image" | "video"; url: string; label?: string }> | null;
  coverImageUrl: string | null;
  productUrl: string | null;
  ratePer1kPaise: number;
  ratePer1kDisplay: string;
  maxPayoutPaise: number;
  budgetPaise: number;
  budgetUsedPaise: number;
  poolPercent: number;
  poolRemainingPercent: number;
  newClipperIntakeStatus: "open" | "closed_at_threshold" | "manually_extended";
  startDate: string | null;
  createdAt: string;
  updatedAt?: string;
  submissionCount?: number;
  brandCompanyName?: string | null;
  pendingInviteEmail?: string | null;
};

export type PaginatedCampaigns = {
  items: Campaign[];
  total: number;
  page: number;
  limit: number;
};

export type CampaignStatusFilter = "all" | "draft" | "live" | "paused" | "closed";

export type SubmissionListItem = {
  id: string;
  status: string;
  mediaType: string;
  campaignId: string;
  campaignTitle: string;
  creatorId: string;
  creatorName: string;
  eligibleViews: number;
  estimatedPaise: number;
  submittedAt: string;
};

export type RejectionHistoryEvent = {
  id: string;
  rejectionReason: string;
  draftDriveUrl: string;
  rejectedAt: string;
  reviewedByDisplayName: string | null;
};

export type CreatorProfileSnippet = {
  id: string;
  platform: string;
  handle: string;
  label: string | null;
  avatarUrl: string | null;
};

export type DeliverableListItem = {
  id: string;
  platform: string;
  status: string;
  draftDriveUrl: string | null;
  draftSubmittedAt: string | null;
  campaignId: string;
  campaignTitle: string;
  participationId: string;
  joinedAt: string;
  creatorId: string;
  creatorName: string;
  creatorProfile: CreatorProfileSnippet;
  priorRejectionCount: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  estimatedPaise: number;
  siblingDeliverables: Array<{
    id: string;
    platform: string;
    status: string;
  }>;
};

export type DeliverableDetail = {
  id: string;
  platform: string;
  status: string;
  draftDriveUrl: string | null;
  adminUploadedDraftUrl: string | null;
  livePostUrl: string | null;
  rejectionReason: string | null;
  draftSubmittedAt: string | null;
  draftReviewedAt: string | null;
  liveSubmittedAt: string | null;
  proofReviewedAt: string | null;
  participationId: string;
  rejectionHistory: RejectionHistoryEvent[];
  campaign: { id: string; title: string; status: string; ratePer1kDisplay: string; budgetPaise: number };
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  estimatedPaise: number;
  creator: {
    id: string;
    displayName: string | null;
    username: string | null;
    phone: string | null;
  };
  creatorProfile: CreatorProfileSnippet;
  siblingDeliverables: Array<{
    id: string;
    platform: string;
    status: string;
    draftDriveUrl: string | null;
    rejectionReason: string | null;
  }>;
  autoReview: AutoReviewResult[];
  autoReviewMaxRetries: number;
};

/** One shadow-mode auto-review pipeline run — most recent first. Purely
 * informational (never drives status); empty until AUTO_REVIEW_ENABLED is on
 * and at least one submission has gone through the pipeline. */
export type AutoReviewResult = {
  id: string;
  stage: "draft" | "proof";
  decision: "auto_approved" | "auto_rejected" | "needs_review";
  tier1Results: Array<{ gate: string; status: "pass" | "fail" | "unresolved"; reason: string }>;
  tier2Results: Array<{
    criterionId: string;
    label: string;
    pass: boolean;
    confidence: number;
    reason: string;
    required: boolean;
  }> | null;
  modelVersion: string | null;
  createdAt: string;
};

export type BrandStats = {
  liveCampaigns: number;
  pendingReviews: number;
  budgetUsedPaise: number;
  totalViews: number;
};

export type BrandMe = {
  id: string;
  role: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  companyName: string | null;
  bio: string | null;
  socialLinks: Record<string, string> | null;
  brandProfile?: { id: string; companyName: string; logoUrl?: string | null } | null;
};

/** A single linked platform handle (Instagram/YouTube/etc) under one creator login — the "account switcher". */
export type LinkedCreatorProfile = {
  id: string;
  platform: string;
  handle: string;
  label: string | null;
  avatarUrl: string | null;
  isDefault: boolean;
  socialLinks: Record<string, string>;
};

export type AdminBrand = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  email: string | null;
  displayName: string | null;
  campaignCount: number;
  createdAt: string;
};

export type AdminBrandDetail = {
  id: string;
  companyName: string;
  companyEmail: string | null;
  logoUrl: string | null;
  email: string | null;
  displayName: string | null;
  pocName: string | null;
  pocPhone: string | null;
  pocEmail: string | null;
  createdAt: string;
  campaigns: Campaign[];
  assignedStaff: { id: string; name: string; email: string; accessLevel: string }[];
};

export type KycStatus = "not_started" | "pending" | "verified" | "rejected";

export type AdminCreatorSummary = {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  verifiedCreatorId: string | null;
  kycStatus: KycStatus;
  isActive: boolean;
  createdAt: string;
  campaignCount: number;
  walletAvailablePaise: number;
  walletLifetimePaise: number;
};

export type AdminCreatorCampaignEntry = {
  campaignId: string;
  title: string;
  status: string;
  coverImageUrl: string | null;
  viewCount: number;
  earnedPaise: number;
};

export type AdminCreatorPayoutMethod = {
  id: string;
  type: string;
  label: string;
  accountHolderName: string;
  accountMasked: string;
  ifscCode: string | null;
  bankName: string | null;
  panNumber: string | null;
  isDefault: boolean;
};

export type AdminCreatorWithdrawal = {
  id: string;
  amountPaise: number;
  feePaise: number;
  netPaise: number;
  status: string;
  createdAt: string;
  processedAt: string | null;
};

export type AdminCreatorPan = {
  number: string | null;
  documentUrl: string | null;
  verificationStatus: KycStatus;
  verifiedName: string | null;
  verifiedAt: string | null;
  failureReason: string | null;
};

export type AdminCreatorAadhaar = {
  documentUrl: string | null;
  verificationStatus: KycStatus;
  verifiedName: string | null;
  maskedNumber: string | null;
  verifiedAt: string | null;
  failureReason: string | null;
};

export type AdminCreatorInstagramReview = {
  status: KycStatus;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type AdminCreatorInstagramConnection = {
  id: string;
  platformHandle: string;
  followerCount: number;
  followsCount: number;
  mediaCount: number;
  engagementRate: number;
  profilePictureUrl: string | null;
  isConnected: boolean;
  lastSyncedAt: string;
};

export type AdminCreatorDetail = {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: Record<string, string> | null;
  verifiedCreatorId: string | null;
  kycStatus: KycStatus;
  kycDocumentUrl: string | null;
  kycDocumentType: string | null;
  kycSubmittedAt: string | null;
  kycRejectionReason: string | null;
  requiresOnboardingGate: boolean;
  pan: AdminCreatorPan;
  aadhaar: AdminCreatorAadhaar;
  instagramReview: AdminCreatorInstagramReview;
  instagramConnections: AdminCreatorInstagramConnection[];
  isActive: boolean;
  createdAt: string;
  linkedProfiles: LinkedCreatorProfile[];
  wallet: { availablePaise: number; pendingPaise: number; lifetimePaise: number };
  payoutMethods: AdminCreatorPayoutMethod[];
  withdrawals: AdminCreatorWithdrawal[];
  runningCampaigns: AdminCreatorCampaignEntry[];
  pastCampaigns: AdminCreatorCampaignEntry[];
  totalViews: number;
  totalEarnedPaise: number;
};

export type AdminVerificationSummary = {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  instagramReviewStatus: KycStatus;
  overallStatus: "pending" | "approved" | "rejected";
  updatedAt: string;
};

export type StaffBrand = {
  id: string;
  companyName: string;
  logoUrl: string | null;
  companyEmail: string | null;
  campaignCount: number;
  assignedAt: string;
};

export type StaffAccessLevel = "view_only" | "full";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  assignedBrands: { id: string; companyName: string; logoUrl: string | null; accessLevel: StaffAccessLevel }[];
};

export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: string; name: string };
  brand: { id: string; companyName: string } | null;
};

export type ActivityLogEntry = {
  id: string;
  action: string;
  label: string;
  brandName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type CampaignInvite = {
  id: string;
  campaignId: string;
  email: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type SupportTicketStatus = "under_investigation" | "resolved";

export type AdminSupportTicket = {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    displayName: string | null;
    username: string | null;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  };
};

export type AdminSection =
  | "dashboard"
  | "brands"
  | "clippers"
  | "campaigns"
  | "analytics"
  | "tickets"
  | "faqs"
  | "notifications"
  | "team";

export type AdminPermissionLevel = "hidden" | "view" | "manage";

export type AdminRole = {
  id: string;
  name: string;
  canSeeMoney: boolean;
  userCount: number;
  permissions: { section: AdminSection; level: AdminPermissionLevel }[];
  createdAt: string;
  updatedAt: string;
};

export type AdminRolesList = {
  superAdmin: { userCount: number };
  roles: AdminRole[];
};

export type EffectiveAdminPermissions = {
  isSuperAdmin: boolean;
  canSeeMoney: boolean;
  sections: Record<AdminSection, AdminPermissionLevel>;
};

export type AdminAccount = {
  id: string;
  name: string;
  email: string | null;
  adminRoleId: string | null;
  adminRoleName: string;
};

export type Faq = {
  id: string;
  question: string;
  answer: string;
  order: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BulkNotificationChannelStatus = {
  pushConfigured: boolean;
  whatsappConfigured: boolean;
};

export type BulkNotificationLog = {
  id: string;
  title: string;
  message: string;
  usedPush: boolean;
  usedWhatsapp: boolean;
  recipientCount: number;
  pushSentCount: number;
  pushFailedCount: number;
  whatsappSentCount: number;
  whatsappFailedCount: number;
  createdAt: string;
  sentBy: string;
};

export type BulkNotificationHistoryPage = {
  items: BulkNotificationLog[];
  total: number;
  page: number;
  totalPages: number;
};

export type AdminSupportTicketDetail = AdminSupportTicket & {
  creator: AdminSupportTicket["creator"] & {
    kycStatus: KycStatus;
    createdAt: string;
  };
};

const campaignsApi = {
  list: (
    token: string,
    params?: { status?: string; search?: string; page?: number; limit?: number },
  ) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.search) search.set("search", params.search);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    const q = search.toString();
    return apiFetch<PaginatedCampaigns>(`/campaigns${q ? `?${q}` : ""}`, {
      accessToken: token,
    });
  },
  get: (token: string, id: string) =>
    apiFetch<Campaign & { submissionCount: number }>(`/campaigns/${id}`, {
      accessToken: token,
    }),
  create: (token: string, body: Record<string, unknown>) =>
    apiFetch<Campaign>("/campaigns", {
      method: "POST",
      accessToken: token,
      body: JSON.stringify(body),
    }),
  update: (token: string, id: string, body: Record<string, unknown>) =>
    apiFetch<Campaign>(`/campaigns/${id}`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify(body),
    }),
  updateStep: (token: string, id: string, body: Record<string, unknown>) =>
    apiFetch<Campaign>(`/campaigns/${id}/step`, {
      method: "PATCH",
      accessToken: token,
      body: JSON.stringify(body),
    }),
  delete: (token: string, id: string) =>
    apiFetch<{ deleted: boolean; id: string }>(`/campaigns/${id}`, {
      method: "DELETE",
      accessToken: token,
    }),
  /** Sample content and source files, any size up to 5 GB — straight to R2. */
  uploadReferenceAsset: (token: string, file: File) =>
    uploadDirect(token, file, "campaign-asset", {
      legacy: async () =>
        asResult(await legacyForm<{ url: string; path?: string; type: "image" | "video"; name: string }>("/campaigns/reference-assets/upload", token, file), file),
    }),
  /** "Upload from device" source files — up to 3 GB, straight to R2. */
  uploadSourceAsset: (token: string, file: File) =>
    uploadDirect(token, file, "campaign-source", {
      legacy: async () =>
        asResult(await legacyForm<{ url: string; path?: string; type: "image" | "video"; name: string }>("/campaigns/reference-assets/upload", token, file), file),
    }),
  checkSourceAssetUrl: (token: string, url: string) =>
    apiFetch<{ fetchable: boolean; reason?: string }>("/campaigns/source-assets/check-url", {
      method: "POST",
      accessToken: token,
      body: JSON.stringify({ url }),
    }),
  uploadCoverImage: (token: string, file: File) =>
    uploadDirect(token, file, "campaign-cover", {
      legacy: async () => asResult(await legacyForm<{ url: string; path?: string; name: string }>("/campaigns/cover/upload", token, file), file),
    }),
};

const submissionsApi = {
  listByCampaign: (token: string, campaignId: string) =>
    apiFetch<DeliverableListItem[]>(`/submissions/deliverables?campaignId=${campaignId}`, {
      accessToken: token,
    }),
  get: (token: string, id: string) =>
    apiFetch<DeliverableDetail>(`/submissions/deliverables/${id}`, {
      accessToken: token,
    }),
  review: (
    token: string,
    id: string,
    body: { action: "approve" | "reject"; rejectionReason?: string },
  ) =>
    apiFetch<{ id: string; status: string }>(
      `/submissions/deliverables/${id}/review`,
      {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify(body),
      },
    ),
  uploadAdminDraftCopy: (token: string, deliverableId: string, file: File) =>
    uploadDirect<{ id: string; adminUploadedDraftUrl: string }>(token, file, "admin-draft-copy", {
      deliverableId,
      legacy: async () => {
        const r = await legacyForm<{ id: string; adminUploadedDraftUrl: string }>(
          `/submissions/deliverables/${deliverableId}/admin-draft-copy`,
          token,
          file,
        );
        return { ...asResult({ url: r.adminUploadedDraftUrl }, file), ...r };
      },
    }),
  approveProof: (token: string, deliverableId: string) =>
    apiFetch<{ id: string; status: string }>(
      `/submissions/deliverables/${deliverableId}/approve-proof`,
      { method: "PATCH", accessToken: token },
    ),
  rejectProof: (token: string, deliverableId: string, reason: string) =>
    apiFetch<{ id: string; status: string }>(
      `/submissions/deliverables/${deliverableId}/reject-proof`,
      {
        method: "PATCH",
        accessToken: token,
        body: JSON.stringify({ reason }),
      },
    ),
  analyticsOverview: (token: string) =>
    apiFetch<AnalyticsOverview>("/submissions/analytics", { accessToken: token }),
  refreshViews: (token: string, deliverableId: string) =>
    apiFetch<{
      id: string;
      viewCount: number;
      reach: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
      payoutCapped: boolean;
      metricsSource: "instagram_insights" | "apify" | "unavailable";
    }>(`/submissions/deliverables/${deliverableId}/refresh-views`, {
      method: "POST",
      accessToken: token,
    }),
};

export type AnalyticsOverview = {
  totals: {
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalEarningsPaise: number;
    totalCampaigns: number;
    totalClippers: number;
  };
  campaigns: Array<{
    id: string;
    title: string;
    status: string;
    coverImageUrl: string | null;
    totalViews: number;
    totalEarningsPaise: number;
    clipperCount: number;
  }>;
  topCreators: Array<{
    creatorId: string;
    creatorName: string;
    avatarUrl: string | null;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalEarningsPaise: number;
  }>;
};

export const portalApi = {
  me: (token: string) =>
    apiFetch<BrandMe>("/users/me", { accessToken: token }),

  updateBrandProfile: (
    token: string,
    body: { companyName?: string; displayName?: string; logoUrl?: string },
  ) =>
    apiFetch<{ companyName: string; logoUrl: string | null; displayName: string | null }>(
      "/users/me/brand-profile",
      { method: "PATCH", body: JSON.stringify(body), accessToken: token },
    ),

  updateProfile: (
    token: string,
    body: {
      displayName?: string;
      phone?: string;
      bio?: string;
      avatarUrl?: string;
      socialLinks?: Record<string, string>;
    },
  ) =>
    apiFetch<{
      displayName: string | null;
      phone: string | null;
      bio: string | null;
      avatarUrl: string | null;
      socialLinks: Record<string, string> | null;
    }>("/users/me", { method: "PATCH", body: JSON.stringify(body), accessToken: token }),

  changePassword: (
    token: string,
    body: { currentPassword: string; newPassword: string },
  ) =>
    apiFetch<{ changed: boolean }>("/users/me/change-password", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  uploadBrandLogo: (token: string, file: File) =>
    uploadDirect(token, file, "brand-logo", {
      legacy: async () => asResult(await legacyForm<{ url: string }>("/users/me/brand-logo", token, file), file),
    }),

  /** Also sets the caller's profile photo (server-side, on completion). */
  uploadAvatar: (token: string, file: File) =>
    uploadDirect(token, file, "avatar", {
      legacy: async () => asResult(await legacyForm<{ url: string }>("/users/me/avatar", token, file), file),
    }),

  stats: (token: string) =>
    apiFetch<BrandStats>("/submissions/stats", { accessToken: token }),

  campaigns: campaignsApi,
  submissions: submissionsApi,
};

export type CampaignPayoutDeliverable = {
  id: string;
  platform: string;
  viewCount: number;
  earnedPaise: number;
  paidAt: string | null;
  paidAmountPaise: number | null;
};

export type CampaignCreatorPayout = {
  creatorId: string;
  creatorName: string;
  deliverables: CampaignPayoutDeliverable[];
  totalApprovedPaise: number;
  totalUnpaidPaise: number;
  totalPaidPaise: number;
};

export type PayoutResult = {
  paidCount: number;
  totalPaidPaise: number;
};

export const adminApi = {
  dashboard: (token: string) =>
    apiFetch<{
      brandCount: number;
      campaignCount: number;
      activeCampaignCount: number;
      pendingInvites: number;
      totalViews: number;
      totalSpentPaise: number;
      pendingTasks: {
        id: string;
        status: string;
        platform: string;
        draftSubmittedAt: string | null;
        creatorId: string;
        creatorName: string;
        campaignId: string;
        campaignTitle: string;
      }[];
      topClippers: {
        creatorId: string;
        creatorName: string;
        totalViews: number;
        earnedPaise: number;
      }[];
    }>("/admin/dashboard", { accessToken: token }),

  brands: (token: string) =>
    apiFetch<AdminBrand[]>("/admin/brands", { accessToken: token }),

  brand: (token: string, id: string) =>
    apiFetch<AdminBrandDetail>(`/admin/brands/${id}`, { accessToken: token }),

  updateBrand: (token: string, id: string, body: { companyName?: string; companyEmail?: string; pocName?: string; pocPhone?: string; pocEmail?: string; logoUrl?: string }) =>
    apiFetch<AdminBrandDetail>(`/admin/brands/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  deleteBrand: (token: string, id: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/brands/${id}`, {
      method: "DELETE",
      accessToken: token,
    }),

  creators: (token: string) =>
    apiFetch<AdminCreatorSummary[]>("/admin/creators", { accessToken: token }),

  verifications: (token: string) =>
    apiFetch<AdminVerificationSummary[]>("/admin/verifications", { accessToken: token }),

  creator: (token: string, id: string) =>
    apiFetch<AdminCreatorDetail>(`/admin/creators/${id}`, { accessToken: token }),

  reviewKyc: (token: string, id: string, action: "approve" | "reject", reason?: string) =>
    apiFetch<{ id: string; kycStatus: KycStatus }>(`/admin/creators/${id}/kyc-review`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
      accessToken: token,
    }),

  reviewInstagramOnboarding: (token: string, id: string, action: "approve" | "reject", reason?: string) =>
    apiFetch<{ id: string; instagramReviewStatus: KycStatus }>(`/admin/creators/${id}/instagram-review`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
      accessToken: token,
    }),

  revealPayoutMethodAccountNumber: (token: string, payoutMethodId: string) =>
    apiFetch<{ accountNumber: string }>(`/admin/payout-methods/${payoutMethodId}/reveal`, {
      accessToken: token,
    }),

  supportTickets: (token: string, status?: SupportTicketStatus) =>
    apiFetch<AdminSupportTicket[]>(
      `/admin/support-tickets${status ? `?status=${status}` : ""}`,
      { accessToken: token },
    ),

  supportTicket: (token: string, id: string) =>
    apiFetch<AdminSupportTicketDetail>(`/admin/support-tickets/${id}`, { accessToken: token }),

  respondToSupportTicket: (
    token: string,
    id: string,
    action: "investigating" | "resolved",
    note: string,
  ) =>
    apiFetch<AdminSupportTicket>(`/admin/support-tickets/${id}/respond`, {
      method: "POST",
      body: JSON.stringify({ action, note }),
      accessToken: token,
    }),

  bulkNotificationChannelStatus: (token: string) =>
    apiFetch<BulkNotificationChannelStatus>("/admin/bulk-notifications/channel-status", {
      accessToken: token,
    }),

  sendBulkNotification: (
    token: string,
    body: { recipientIds: string[]; usePush: boolean; useWhatsapp: boolean; title: string; message: string },
  ) =>
    apiFetch<BulkNotificationLog>("/admin/bulk-notifications", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  bulkNotificationHistory: (token: string, page = 1) =>
    apiFetch<BulkNotificationHistoryPage>(`/admin/bulk-notifications?page=${page}`, {
      accessToken: token,
    }),

  faqs: (token: string) => apiFetch<Faq[]>("/admin/faqs", { accessToken: token }),

  createFaq: (token: string, body: { question: string; answer: string; isVisible?: boolean }) =>
    apiFetch<Faq>("/admin/faqs", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  updateFaq: (
    token: string,
    id: string,
    body: { question?: string; answer?: string; isVisible?: boolean },
  ) =>
    apiFetch<Faq>(`/admin/faqs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  deleteFaq: (token: string, id: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/faqs/${id}`, {
      method: "DELETE",
      accessToken: token,
    }),

  reorderFaqs: (token: string, orderedIds: string[]) =>
    apiFetch<Faq[]>("/admin/faqs/reorder", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds }),
      accessToken: token,
    }),

  myPermissions: (token: string) =>
    apiFetch<EffectiveAdminPermissions>("/admin/me/permissions", { accessToken: token }),

  roles: (token: string) => apiFetch<AdminRolesList>("/admin/roles", { accessToken: token }),

  createRole: (token: string, body: { name: string; canSeeMoney?: boolean }) =>
    apiFetch<AdminRole>("/admin/roles", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  updateRole: (token: string, id: string, body: { name?: string; canSeeMoney?: boolean }) =>
    apiFetch<AdminRole>(`/admin/roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  deleteRole: (token: string, id: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/roles/${id}`, {
      method: "DELETE",
      accessToken: token,
    }),

  setRolePermissions: (
    token: string,
    id: string,
    permissions: { section: AdminSection; level: AdminPermissionLevel }[],
  ) =>
    apiFetch<AdminRole>(`/admin/roles/${id}/permissions`, {
      method: "PATCH",
      body: JSON.stringify({ permissions }),
      accessToken: token,
    }),

  resetRoles: (token: string) =>
    apiFetch<AdminRolesList>("/admin/roles/reset", { method: "PATCH", accessToken: token }),

  assignAdminRole: (token: string, userId: string, adminRoleId: string | null) =>
    apiFetch<{ id: string; adminRoleId: string | null }>(`/admin/admins/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ adminRoleId }),
      accessToken: token,
    }),

  adminAccounts: (token: string) =>
    apiFetch<AdminAccount[]>("/admin/admins", { accessToken: token }),

  createAdmin: (
    token: string,
    body: { name: string; email: string; password: string; adminRoleId?: string | null },
  ) =>
    apiFetch<AdminAccount>("/admin/admins", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  uploadBrandLogo: (token: string, file: File) =>
    uploadDirect(token, file, "admin-brand-logo", {
      legacy: async () => asResult(await legacyForm<{ url: string }>("/admin/brand-logo", token, file), file),
    }),

  createBrand: (token: string, body: { companyName: string; companyEmail: string; pocName?: string; pocPhone?: string; pocEmail?: string; logoUrl?: string }) =>
    apiFetch<AdminBrand & { tempPassword: string; companyEmail?: string; pocName?: string; pocPhone?: string; pocEmail?: string }>("/admin/brands", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  campaigns: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    const q = search.toString();
    return apiFetch<PaginatedCampaigns>(`/admin/campaigns${q ? `?${q}` : ""}`, {
      accessToken: token,
    });
  },

  listInvites: (token: string, campaignId: string) =>
    apiFetch<CampaignInvite[]>(`/admin/campaigns/${campaignId}/invites`, {
      accessToken: token,
    }),

  sendInvite: (token: string, campaignId: string, email: string) =>
    apiFetch<CampaignInvite>(`/admin/campaigns/${campaignId}/invites`, {
      method: "POST",
      accessToken: token,
      body: JSON.stringify({ email }),
    }),

  revokeInvite: (token: string, campaignId: string, inviteId: string) =>
    apiFetch<{ revoked: boolean; id: string }>(
      `/admin/campaigns/${campaignId}/invites/${inviteId}`,
      { method: "DELETE", accessToken: token },
    ),

  campaignsCrud: campaignsApi,
  submissions: submissionsApi,
  stats: (token: string) =>
    apiFetch<BrandStats>("/submissions/stats", { accessToken: token }),

  // Team members
  listTeamMembers: (token: string) =>
    apiFetch<StaffMember[]>("/admin/team-members", { accessToken: token }),

  createTeamMember: (token: string, body: { name: string; email: string; password: string }) =>
    apiFetch<StaffMember>("/admin/team-members", {
      method: "POST",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  assignBrand: (token: string, staffId: string, brandId: string, accessLevel?: StaffAccessLevel) =>
    apiFetch<{ assigned: boolean }>(`/admin/team-members/${staffId}/brands/${brandId}`, {
      method: "POST",
      body: JSON.stringify(accessLevel ? { accessLevel } : {}),
      accessToken: token,
    }),

  deactivateStaff: (token: string, staffId: string) =>
    apiFetch<{ deactivated: boolean }>(`/admin/team-members/${staffId}/deactivate`, {
      method: "POST",
      accessToken: token,
    }),

  reactivateStaff: (token: string, staffId: string) =>
    apiFetch<{ reactivated: boolean }>(`/admin/team-members/${staffId}/reactivate`, {
      method: "POST",
      accessToken: token,
    }),

  deleteTeamMember: (token: string, staffId: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/team-members/${staffId}`, {
      method: "DELETE",
      accessToken: token,
    }),

  getStaffActivity: (token: string, staffId: string) =>
    apiFetch<ActivityLogEntry[]>(`/admin/team-members/${staffId}/activity`, { accessToken: token }),

  createTask: (token: string, body: { title: string; description?: string; assignedToUserId: string; brandProfileId?: string; dueDate?: string }) =>
    apiFetch<Task>("/admin/tasks", { method: "POST", body: JSON.stringify(body), accessToken: token }),

  listTasks: (token: string, params?: { staffId?: string; status?: TaskStatus }) => {
    const search = new URLSearchParams();
    if (params?.staffId) search.set("staffId", params.staffId);
    if (params?.status) search.set("status", params.status);
    const q = search.toString();
    return apiFetch<Task[]>(`/admin/tasks${q ? `?${q}` : ""}`, { accessToken: token });
  },

  deleteTask: (token: string, taskId: string) =>
    apiFetch<{ deleted: boolean }>(`/admin/tasks/${taskId}`, { method: "DELETE", accessToken: token }),

  removeBrand: (token: string, staffId: string, brandId: string) =>
    apiFetch<{ removed: boolean }>(`/admin/team-members/${staffId}/brands/${brandId}`, {
      method: "DELETE",
      accessToken: token,
    }),

  // Payouts
  campaignPayouts: (token: string, campaignId: string) =>
    apiFetch<CampaignCreatorPayout[]>(`/admin/campaigns/${campaignId}/payouts`, {
      accessToken: token,
    }),

  payoutAll: (token: string, campaignId: string) =>
    apiFetch<PayoutResult>(`/admin/campaigns/${campaignId}/payouts/all`, {
      method: "POST",
      accessToken: token,
    }),

  payoutCreator: (token: string, campaignId: string, creatorId: string) =>
    apiFetch<PayoutResult>(`/admin/campaigns/${campaignId}/payouts/creator/${creatorId}`, {
      method: "POST",
      accessToken: token,
    }),

  // Pool / intake overrides
  setClipperIntake: (token: string, campaignId: string, extraClipperAllowance: number) =>
    apiFetch<{
      id: string;
      newClipperIntakeStatus: Campaign["newClipperIntakeStatus"];
      extraClipperAllowance: number | null;
    }>(`/admin/campaigns/${campaignId}/clipper-intake`, {
      method: "PATCH",
      body: JSON.stringify({ extraClipperAllowance }),
      accessToken: token,
    }),

  setPoolOverflow: (token: string, campaignId: string, allowExcessViewsToFillPool: boolean) =>
    apiFetch<{ id: string; allowExcessViewsToFillPool: boolean }>(
      `/admin/campaigns/${campaignId}/pool-overflow`,
      {
        method: "PATCH",
        body: JSON.stringify({ allowExcessViewsToFillPool }),
        accessToken: token,
      },
    ),
};

/** @deprecated use portalApi */
export const brandApi = portalApi;

export const staffApi = {
  brands: (token: string) =>
    apiFetch<StaffBrand[]>("/staff/brands", { accessToken: token }),

  brand: (token: string, brandId: string) =>
    apiFetch<AdminBrandDetail>(`/staff/brands/${brandId}`, { accessToken: token }),

  createCampaign: (token: string, brandId: string, body: Record<string, unknown>) =>
    apiFetch<Campaign>(`/staff/brands/${brandId}/campaigns`, {
      method: "POST",
      body: JSON.stringify(body),
      accessToken: token,
    }),

  listMyTasks: (token: string) =>
    apiFetch<Task[]>("/staff/tasks", { accessToken: token }),

  updateTaskStatus: (token: string, taskId: string, status: TaskStatus) =>
    apiFetch<Task>(`/staff/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
      accessToken: token,
    }),
};

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export const notificationsApi = {
  list: (token: string) =>
    apiFetch<AppNotification[]>("/notifications", { accessToken: token }),

  unreadCount: (token: string) =>
    apiFetch<{ count: number }>("/notifications/unread-count", { accessToken: token }),

  markRead: (token: string, id: string) =>
    apiFetch<{ read: boolean }>(`/notifications/${id}/read`, { method: "PATCH", accessToken: token }),

  markAllRead: (token: string) =>
    apiFetch<{ read: boolean }>("/notifications/read-all", { method: "PATCH", accessToken: token }),
};

export type CreatorCampaignSummary = {
  campaignId: string;
  title: string;
  status: string;
};

export type CreatorProfile = {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  socialLinks: Record<string, string> | null;
  createdAt: string;
  linkedProfiles: LinkedCreatorProfile[];
  runningCampaigns: CreatorCampaignSummary[];
  pastCampaigns: CreatorCampaignSummary[];
};

export const creatorApi = {
  get: (token: string, id: string) =>
    apiFetch<CreatorProfile>(`/creators/${id}`, { accessToken: token }),
};
