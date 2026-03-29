import User from "../../models/user.model.js";
import JobPost from "../../models/jobPost.model.js";
import JobApplication from "../../models/jobApplication.model.js";
import { sendResponse } from "../../utils/response.js";

function startOfUTCDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function applicantLabel(u) {
  if (!u) return "User";
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return name || u.email || "User";
}

/** GET /admin/dashboard-stats — aggregate counts + recent signups/jobs (no mock metrics). */
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      employers,
      jobSeekers,
      admins,
      publishedJobs,
      totalJobs,
      totalApplications,
      interviewsScheduled,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "employer" }),
      User.countDocuments({ role: "employee" }),
      User.countDocuments({ role: "admin" }),
      JobPost.countDocuments({ status: "published" }),
      JobPost.countDocuments({}),
      JobApplication.countDocuments({}),
      JobApplication.countDocuments({ status: "interview_scheduled" }),
    ]);

    const todayStart = startOfUTCDay(new Date());
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

    const [jobsPostedToday, applicationsToday] = await Promise.all([
      JobPost.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),
      JobApplication.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),
    ]);

    const now = new Date();
    const monthRanges = [];
    for (let i = 5; i >= 0; i -= 1) {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));
      const label = monthStart.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
      monthRanges.push({ monthStart, monthEnd, label });
    }

    const growth = await Promise.all(
      monthRanges.map(async ({ monthStart, monthEnd, label }) => {
        const [e, j] = await Promise.all([
          User.countDocuments({
            role: "employer",
            createdAt: { $gte: monthStart, $lt: monthEnd },
          }),
          User.countDocuments({
            role: "employee",
            createdAt: { $gte: monthStart, $lt: monthEnd },
          }),
        ]);
        return { label, employers: e, jobSeekers: j };
      })
    );

    const [recentEmployers, recentEmployees, recentJobs] = await Promise.all([
      User.find({ role: "employer" })
        .sort({ createdAt: -1 })
        .limit(4)
        .select("firstName lastName email createdAt companyProfile")
        .populate("companyProfile", "companyDetails.companyName")
        .lean(),
      User.find({ role: "employee" })
        .sort({ createdAt: -1 })
        .limit(4)
        .select("firstName lastName email createdAt")
        .lean(),
      JobPost.find()
        .sort({ createdAt: -1 })
        .limit(4)
        .select("title status createdAt employer")
        .populate("employer", "firstName lastName email")
        .lean(),
    ]);

    const activity = [];

    for (const u of recentEmployers) {
      const company = u.companyProfile?.companyDetails?.companyName?.trim?.();
      activity.push({
        type: "employer_registered",
        title: "Employer registered",
        sub: company || applicantLabel(u),
        at: u.createdAt,
      });
    }
    for (const u of recentEmployees) {
      activity.push({
        type: "job_seeker_registered",
        title: "Job seeker registered",
        sub: applicantLabel(u),
        at: u.createdAt,
      });
    }
    for (const job of recentJobs) {
      const emp = job.employer;
      const empLabel = emp ? applicantLabel(emp) : "Employer";
      activity.push({
        type: "job_posted",
        title: "Job posted",
        sub: `${job.title || "Untitled"} · ${empLabel}`,
        at: job.createdAt,
      });
    }

    activity.sort((a, b) => new Date(b.at) - new Date(a.at));
    const recentActivity = activity.slice(0, 10);

    return sendResponse(res, 200, true, {
      counts: {
        totalUsers,
        employers,
        jobSeekers,
        admins,
        publishedJobs,
        totalJobs,
        totalApplications,
        interviewsScheduled,
        jobsPostedToday,
        applicationsToday,
      },
      growth,
      recentActivity,
    });
  } catch (err) {
    console.error("getDashboardStats error:", err);
    return sendResponse(res, 500, false, { message: "Failed to load dashboard stats." });
  }
};
