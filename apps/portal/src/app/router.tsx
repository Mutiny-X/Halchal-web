import { lazy, Suspense } from "react";
import { LandingPage } from "@/features/landing/pages/LandingPage";
import { DeleteAccountPage } from "@/features/legal/pages/DeleteAccountPage";
import { PrivacyPolicyPage } from "@/features/legal/pages/PrivacyPolicyPage";
import { SupportPage } from "@/features/legal/pages/SupportPage";
import { TermsPage } from "@/features/legal/pages/TermsPage";
import { createBrowserRouter, Navigate } from "react-router-dom";

import {
  CampaignListSkeleton,
  DetailPageSkeleton,
  PortalShellSkeleton,
} from "@/components/ui/page-skeletons";
import { AuthLayout } from "@/routes/AuthLayout";
import { CampaignWizardLayout } from "@/routes/CampaignWizardLayout";
import { AdminRoute } from "@/routes/guards/AdminRoute";
import { GuestRoute } from "@/routes/guards/GuestRoute";
import { ProtectedRoute } from "@/routes/guards/ProtectedRoute";
import { StaffRoute } from "@/routes/guards/StaffRoute";
import { PortalLayout } from "@/routes/PortalLayout";
import { RootLayout } from "@/routes/RootLayout";

const LoginPage = lazy(() =>
  import("@/features/auth/pages/LoginPage").then((m) => ({
    default: m.LoginPage,
  })),
);
const AdminLoginPage = lazy(() =>
  import("@/features/auth/pages/AdminLoginPage").then((m) => ({
    default: m.AdminLoginPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("@/features/auth/pages/ForgotPasswordPage").then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("@/features/auth/pages/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage,
  })),
);

const AdminDashboardPage = lazy(() =>
  import("@/features/admin/pages/AdminDashboardPage").then((m) => ({
    default: m.AdminDashboardPage,
  })),
);
const AdminBrandsPage = lazy(() =>
  import("@/features/admin/pages/AdminBrandsPage").then((m) => ({
    default: m.AdminBrandsPage,
  })),
);
const AdminBrandDetailPage = lazy(() =>
  import("@/features/admin/pages/AdminBrandDetailPage").then((m) => ({
    default: m.AdminBrandDetailPage,
  })),
);
const AdminClippersPage = lazy(() =>
  import("@/features/admin/pages/AdminClippersPage").then((m) => ({
    default: m.AdminClippersPage,
  })),
);
const AdminClipperDetailPage = lazy(() =>
  import("@/features/admin/pages/AdminClipperDetailPage").then((m) => ({
    default: m.AdminClipperDetailPage,
  })),
);
const AdminPayoutsPage = lazy(() =>
  import("@/features/admin/pages/AdminPayoutsPage").then((m) => ({
    default: m.AdminPayoutsPage,
  })),
);
const AdminVerificationsPage = lazy(() =>
  import("@/features/admin/pages/AdminVerificationsPage").then((m) => ({
    default: m.AdminVerificationsPage,
  })),
);
const AdminSupportTicketsPage = lazy(() =>
  import("@/features/admin/pages/AdminSupportTicketsPage").then((m) => ({
    default: m.AdminSupportTicketsPage,
  })),
);
const AdminNotificationsPage = lazy(() =>
  import("@/features/admin/pages/AdminNotificationsPage").then((m) => ({
    default: m.AdminNotificationsPage,
  })),
);
const AdminFaqsPage = lazy(() =>
  import("@/features/admin/pages/AdminFaqsPage").then((m) => ({
    default: m.AdminFaqsPage,
  })),
);
const AdminSupportTicketDetailPage = lazy(() =>
  import("@/features/admin/pages/AdminSupportTicketDetailPage").then((m) => ({
    default: m.AdminSupportTicketDetailPage,
  })),
);
const AdminProfilePage = lazy(() =>
  import("@/features/admin/pages/AdminProfilePage").then((m) => ({
    default: m.AdminProfilePage,
  })),
);
const AdminTeamPage = lazy(() =>
  import("@/features/admin/pages/AdminTeamPage").then((m) => ({
    default: m.AdminTeamPage,
  })),
);
const StaffBrandsPage = lazy(() =>
  import("@/features/staff/pages/StaffBrandsPage").then((m) => ({
    default: m.StaffBrandsPage,
  })),
);
const StaffBrandPage = lazy(() =>
  import("@/features/staff/pages/StaffBrandPage").then((m) => ({
    default: m.StaffBrandPage,
  })),
);
const StaffProfilePage = lazy(() =>
  import("@/features/staff/pages/StaffProfilePage").then((m) => ({
    default: m.StaffProfilePage,
  })),
);
const StaffTasksPage = lazy(() =>
  import("@/features/staff/pages/StaffTasksPage").then((m) => ({
    default: m.StaffTasksPage,
  })),
);
const CampaignsPage = lazy(() =>
  import("@/features/campaigns/pages/CampaignsPage").then((m) => ({
    default: m.CampaignsPage,
  })),
);
const CampaignDetailPage = lazy(() =>
  import("@/features/campaigns/pages/CampaignDetailPage").then((m) => ({
    default: m.CampaignDetailPage,
  })),
);
const CampaignNewBasicsPage = lazy(() =>
  import("@/features/campaigns/pages/CampaignNewBasicsPage").then((m) => ({
    default: m.CampaignNewBasicsPage,
  })),
);
const CampaignBriefPage = lazy(() =>
  import("@/features/campaigns/pages/CampaignBriefPage").then((m) => ({
    default: m.CampaignBriefPage,
  })),
);
const CampaignPayoutPage = lazy(() =>
  import("@/features/campaigns/pages/CampaignPayoutPage").then((m) => ({
    default: m.CampaignPayoutPage,
  })),
);
const CampaignReviewPage = lazy(() =>
  import("@/features/campaigns/pages/CampaignReviewPage").then((m) => ({
    default: m.CampaignReviewPage,
  })),
);

const AnalyticsPage = lazy(() =>
  import("@/features/analytics/pages/AnalyticsPage").then((m) => ({
    default: m.AnalyticsPage,
  })),
);

function withSuspense(fallback: React.ReactNode, element: React.ReactNode) {
  return <Suspense fallback={fallback}>{element}</Suspense>;
}

const wizardRoutes = [
  {
    path: "new",
    element: withSuspense(
      <PortalShellSkeleton />,
      <CampaignNewBasicsPage />,
    ),
  },
  {
    path: "new/brief",
    element: withSuspense(<PortalShellSkeleton />, <CampaignBriefPage />),
  },
  {
    path: "new/payout",
    element: withSuspense(<PortalShellSkeleton />, <CampaignPayoutPage />),
  },
  {
    path: "new/review",
    element: withSuspense(<PortalShellSkeleton />, <CampaignReviewPage />),
  },
  {
    path: ":id/edit",
    element: withSuspense(
      <PortalShellSkeleton />,
      <CampaignNewBasicsPage />,
    ),
  },
  {
    path: ":id/edit/brief",
    element: withSuspense(<PortalShellSkeleton />, <CampaignBriefPage />),
  },
  {
    path: ":id/edit/payout",
    element: withSuspense(<PortalShellSkeleton />, <CampaignPayoutPage />),
  },
  {
    path: ":id/edit/review",
    element: withSuspense(<PortalShellSkeleton />, <CampaignReviewPage />),
  },
];

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      {
        path: "privacy",
        element: <PrivacyPolicyPage />,
      },
      {
        path: "terms",
        element: <TermsPage />,
      },
      {
        path: "delete-account",
        element: <DeleteAccountPage />,
      },
      {
        path: "support",
        element: <SupportPage />,
      },
      {
        element: <GuestRoute />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                path: "login",
                element: withSuspense(null, <LoginPage />),
              },
              {
                path: "admin/login",
                element: withSuspense(null, <AdminLoginPage />),
              },
              {
                path: "forgot-password",
                element: withSuspense(null, <ForgotPasswordPage />),
              },
              {
                path: "reset-password",
                element: withSuspense(null, <ResetPasswordPage />),
              },
            ],
          },
        ],
      },
      {
        element: <ProtectedRoute />,
        children: [
          // Admin-only pages
          {
            element: <AdminRoute />,
            children: [
              {
                element: <PortalLayout />,
                children: [
                  {
                    path: "admin/dashboard",
                    element: withSuspense(<PortalShellSkeleton />, <AdminDashboardPage />),
                  },
                  {
                    path: "admin/brands",
                    element: withSuspense(<PortalShellSkeleton />, <AdminBrandsPage />),
                  },
                  {
                    path: "admin/brands/:id",
                    element: withSuspense(<DetailPageSkeleton />, <AdminBrandDetailPage />),
                  },
                  {
                    path: "admin/clippers",
                    element: withSuspense(<PortalShellSkeleton />, <AdminClippersPage />),
                  },
                  {
                    path: "admin/clippers/:id",
                    element: withSuspense(<DetailPageSkeleton />, <AdminClipperDetailPage />),
                  },
                  {
                    path: "admin/payouts",
                    element: withSuspense(<PortalShellSkeleton />, <AdminPayoutsPage />),
                  },
                  {
                    path: "admin/verifications",
                    element: withSuspense(<PortalShellSkeleton />, <AdminVerificationsPage />),
                  },
                  {
                    path: "admin/support-tickets",
                    element: withSuspense(<PortalShellSkeleton />, <AdminSupportTicketsPage />),
                  },
                  {
                    path: "admin/notifications",
                    element: withSuspense(<PortalShellSkeleton />, <AdminNotificationsPage />),
                  },
                  {
                    path: "admin/faqs",
                    element: withSuspense(<PortalShellSkeleton />, <AdminFaqsPage />),
                  },
                  {
                    path: "admin/support-tickets/:id",
                    element: withSuspense(<DetailPageSkeleton />, <AdminSupportTicketDetailPage />),
                  },
                  {
                    path: "admin/campaigns",
                    element: withSuspense(<CampaignListSkeleton />, <CampaignsPage />),
                  },
                  {
                    element: <CampaignWizardLayout />,
                    children: wizardRoutes.map((r) => ({
                      path: `admin/campaigns/${r.path}`,
                      element: r.element,
                    })),
                  },
                  {
                    path: "admin/campaigns/:id",
                    element: withSuspense(<DetailPageSkeleton />, <CampaignDetailPage />),
                  },
                  {
                    path: "admin/analytics",
                    element: withSuspense(<PortalShellSkeleton />, <AnalyticsPage />),
                  },
                  {
                    path: "admin/profile",
                    element: withSuspense(<PortalShellSkeleton />, <AdminProfilePage />),
                  },
                  {
                    path: "admin/team",
                    element: withSuspense(<PortalShellSkeleton />, <AdminTeamPage />),
                  },
                ],
              },
            ],
          },

          // Staff-only pages
          {
            element: <StaffRoute />,
            children: [
              {
                element: <PortalLayout />,
                children: [
                  {
                    path: "staff/brands",
                    element: withSuspense(<PortalShellSkeleton />, <StaffBrandsPage />),
                  },
                  {
                    path: "staff/brands/:brandId",
                    element: withSuspense(<PortalShellSkeleton />, <StaffBrandPage />),
                  },
                  {
                    path: "staff/tasks",
                    element: withSuspense(<PortalShellSkeleton />, <StaffTasksPage />),
                  },
                  {
                    path: "staff/profile",
                    element: withSuspense(<PortalShellSkeleton />, <StaffProfilePage />),
                  },
                ],
              },
            ],
          },

          // Shared pages — admins and team members
          {
            element: <PortalLayout />,
            children: [
              {
                path: "campaigns/:id",
                element: withSuspense(<DetailPageSkeleton />, <CampaignDetailPage />),
              },
            ],
          },
          {
            element: <CampaignWizardLayout />,
            children: wizardRoutes.map((r) => ({
              path: `campaigns/${r.path}`,
              element: r.element,
            })),
          },
        ],
      },
      // Old brand pages (/dashboard, /campaigns, /signup, …) land on sign-in,
      // which sends a signed-in admin or team member to their own home.
      { path: "*", element: <Navigate to="/login" replace /> },
    ],
  },
]);
