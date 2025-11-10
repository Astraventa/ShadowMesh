import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { 
  Calendar, 
  MapPin, 
  Trophy, 
  Users, 
  BookOpen, 
  Upload, 
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileText,
  Video,
  Link as LinkIcon
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import HackathonRegistration from "@/components/HackathonRegistration";
import EventRegistration from "@/components/EventRegistration";

interface Hackathon {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  location?: string;
  registration_deadline?: string;
  submission_deadline?: string;
  schedule_markdown?: string;
  rules_markdown?: string;
  details_markdown?: string;
  results_published_at?: string;
  status: string;
  category?: string;
  tags?: string[];
  payment_required?: boolean;
  fee_amount?: number;
  fee_currency?: string;
  max_participants?: number;
}

interface Registration {
  id: string;
  status: string;
  hackathon_id: string;
}

interface Team {
  id: string;
  team_name: string;
  hackathon_id: string;
  team_leader_id: string;
  status: string;
  members: Array<{ member_id: string; full_name: string; email: string; role: string }>;
}

interface Submission {
  id: string;
  title: string;
  description?: string;
  artifact_url?: string;
  video_url?: string;
  status: string;
  created_at: string;
}

export default function Hackathon() {
  const { hackathonId } = useParams<{ hackathonId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [hackathon, setHackathon] = useState<Hackathon | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showRegistration, setShowRegistration] = useState(false);

  useEffect(() => {
    async function loadHackathonData() {
      if (!hackathonId) {
        toast({ title: "Invalid hackathon", description: "Hackathon ID is missing.", variant: "destructive" });
        navigate("/member-portal");
        return;
      }

      try {
        setLoading(true);

        // Check authentication
        const authenticated = localStorage.getItem("shadowmesh_authenticated");
        const memberEmail = localStorage.getItem("shadowmesh_member_email");
        
        if (!authenticated || !memberEmail) {
          toast({ title: "Authentication required", description: "Please log in to view hackathon details." });
          navigate("/member-portal");
          return;
        }

        // Get member ID
        const { data: memberData } = await supabase
          .from("members")
          .select("id")
          .eq("email", memberEmail)
          .single();

        if (!memberData) {
          toast({ title: "Member not found", description: "Please ensure you're logged in." });
          navigate("/member-portal");
          return;
        }

        setMemberId(memberData.id);

        // Load hackathon
        const { data: hackathonData, error: hackathonError } = await supabase
          .from("events")
          .select("*")
          .eq("id", hackathonId)
          .eq("event_type", "hackathon")
          .single();

        if (hackathonError || !hackathonData) {
          throw new Error("Hackathon not found");
        }

        setHackathon(hackathonData as Hackathon);

        // Load registration
        const { data: regData } = await supabase
          .from("hackathon_registrations")
          .select("*")
          .eq("hackathon_id", hackathonId)
          .eq("member_id", memberData.id)
          .single();

        if (regData) {
          setRegistration(regData as Registration);
        }

        // Load team (if user is in one)
        const { data: teamData } = await supabase
          .from("hackathon_teams")
          .select(`
            *,
            team_members(
              member_id,
              role,
              members(id, full_name, email)
            )
          `)
          .eq("hackathon_id", hackathonId)
          .or(`team_leader_id.eq.${memberData.id},team_members.member_id.eq.${memberData.id}`)
          .single();

        if (teamData) {
          const formattedTeam = {
            ...teamData,
            members: (teamData.team_members || []).map((tm: any) => ({
              member_id: tm.member_id,
              full_name: tm.members?.full_name || "",
              email: tm.members?.email || "",
              role: tm.role
            }))
          };
          setTeam(formattedTeam as Team);
        }

        // Load submission (if exists)
        const { data: subData } = await supabase
          .from("hackathon_submissions")
          .select("*")
          .eq("hackathon_id", hackathonId)
          .or(`member_id.eq.${memberData.id}${teamData ? `,team_id.eq.${teamData.id}` : ""}`)
          .single();

        if (subData) {
          setSubmission(subData as Submission);
        }

      } catch (error: any) {
        console.error("Error loading hackathon:", error);
        toast({ title: "Failed to load hackathon", description: error.message, variant: "destructive" });
        navigate("/member-portal");
      } finally {
        setLoading(false);
      }
    }

    loadHackathonData();
  }, [hackathonId, navigate, toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading hackathon...</p>
        </div>
      </div>
    );
  }

  if (!hackathon) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Hackathon Not Found</h2>
            <p className="text-muted-foreground mb-4">The hackathon you're looking for doesn't exist.</p>
            <Button asChild>
              <Link to="/member-portal">Back to Portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isApproved = registration?.status === "approved";
  const isPending = registration?.status === "pending";
  const isRejected = registration?.status === "rejected";
  const hasTeam = !!team;
  const hasSubmission = !!submission;
  const now = new Date();
  const startDate = new Date(hackathon.start_date);
  const endDate = hackathon.end_date ? new Date(hackathon.end_date) : null;
  const submissionDeadline = hackathon.submission_deadline ? new Date(hackathon.submission_deadline) : null;
  const registrationDeadline = hackathon.registration_deadline ? new Date(hackathon.registration_deadline) : null;
  
  const isStarted = now >= startDate;
  const isEnded = endDate ? now >= endDate : false;
  const canSubmit = isStarted && !isEnded && (submissionDeadline ? now <= submissionDeadline : true);
  const registrationClosed = registrationDeadline ? now > registrationDeadline : false;
  const resultsPublished = hackathon.results_published_at ? new Date(hackathon.results_published_at) <= now : false;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" asChild>
              <Link to="/member-portal" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Portal
              </Link>
            </Button>
            <Badge variant={hackathon.status === "ongoing" ? "default" : "secondary"}>
              {hackathon.status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-950/90 via-red-900/80 to-amber-950/90 border-b border-purple-800/50">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-amber-950" />
            </div>
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold mb-3 text-white">{hackathon.title}</h1>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Badge className="bg-purple-600 text-white">HACKATHON</Badge>
                {hackathon.category && (
                  <Badge variant="outline" className="border-purple-400 text-purple-200">
                    {hackathon.category.toUpperCase()}
                  </Badge>
                )}
                {hackathon.tags && hackathon.tags.length > 0 && (
                  <>
                    {hackathon.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="bg-purple-800/50 text-purple-200">
                        {tag}
                      </Badge>
                    ))}
                  </>
                )}
              </div>
              {hackathon.description && (
                <p className="text-purple-100/90 text-lg leading-relaxed max-w-3xl">
                  {hackathon.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <Card className="bg-purple-900/30 border-purple-700/50 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-purple-200">
                  <Calendar className="w-5 h-5" />
                  <div>
                    <p className="text-xs text-purple-300">Start Date</p>
                    <p className="font-semibold">{formatDate(hackathon.start_date)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {hackathon.end_date && (
              <Card className="bg-purple-900/30 border-purple-700/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-purple-200">
                    <Clock className="w-5 h-5" />
                    <div>
                      <p className="text-xs text-purple-300">End Date</p>
                      <p className="font-semibold">{formatDate(hackathon.end_date)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {hackathon.location && (
              <Card className="bg-purple-900/30 border-purple-700/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-purple-200">
                    <MapPin className="w-5 h-5" />
                    <div>
                      <p className="text-xs text-purple-300">Location</p>
                      <p className="font-semibold">{hackathon.location}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {hackathon.max_participants && (
              <Card className="bg-purple-900/30 border-purple-700/50 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-purple-200">
                    <Users className="w-5 h-5" />
                    <div>
                      <p className="text-xs text-purple-300">Max Participants</p>
                      <p className="font-semibold">{hackathon.max_participants}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Registration Status */}
          {!isApproved && !isPending && !isRejected && !registrationClosed && (
            <div className="mt-6">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-600/90 hover:to-purple-800/90"
                onClick={() => setShowRegistration(true)}
              >
                Register for Hackathon
              </Button>
            </div>
          )}
          {isPending && (
            <div className="mt-6">
              <Badge variant="outline" className="bg-yellow-900/30 border-yellow-600 text-yellow-200">
                Registration Pending Approval
              </Badge>
            </div>
          )}
          {isRejected && (
            <div className="mt-6">
              <Badge variant="destructive">Registration Rejected</Badge>
            </div>
          )}
          {registrationClosed && !registration && (
            <div className="mt-6">
              <Badge variant="secondary" className="bg-gray-800 text-gray-300">
                Registration Closed
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {isApproved ? (
        <div className="container mx-auto px-4 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 bg-muted/50 backdrop-blur-sm">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
              {resultsPublished && <TabsTrigger value="results">Results</TabsTrigger>}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {hackathon.details_markdown && (
                <Card>
                  <CardHeader>
                    <CardTitle>Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: hackathon.details_markdown }} />
                  </CardContent>
                </Card>
              )}

              {hackathon.schedule_markdown && (
                <Card>
                  <CardHeader>
                    <CardTitle>Schedule</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: hackathon.schedule_markdown }} />
                  </CardContent>
                </Card>
              )}

              {hackathon.rules_markdown && (
                <Card>
                  <CardHeader>
                    <CardTitle>Rules & Guidelines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: hackathon.rules_markdown }} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Teams Tab */}
            <TabsContent value="teams">
              <Card>
                <CardHeader>
                  <CardTitle>Team Management</CardTitle>
                  <CardDescription>
                    {hasTeam ? "Manage your team or find teammates" : "Create or join a team to participate"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasTeam ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <h3 className="font-semibold mb-2">{team.team_name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">Team Members:</p>
                        <div className="space-y-2">
                          {team.members.map((member) => (
                            <div key={member.member_id} className="flex items-center justify-between p-2 bg-background rounded">
                              <div>
                                <p className="font-medium">{member.full_name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                              <Badge>{member.role === "leader" ? "Leader" : "Member"}</Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => navigate("/member-portal")}>
                        Manage Team in Portal
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">You're not in a team yet.</p>
                      <Button onClick={() => navigate("/member-portal")}>
                        Create or Join Team
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources">
              <Card>
                <CardHeader>
                  <CardTitle>Hackathon Resources</CardTitle>
                  <CardDescription>Resources and materials for this hackathon</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Resources will be displayed here.</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Submissions Tab */}
            <TabsContent value="submissions">
              <Card>
                <CardHeader>
                  <CardTitle>Submission</CardTitle>
                  <CardDescription>
                    {hasSubmission ? "View or update your submission" : "Submit your hackathon project"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasSubmission ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-muted rounded-lg">
                        <h3 className="font-semibold mb-2">{submission.title}</h3>
                        {submission.description && (
                          <p className="text-sm text-muted-foreground mb-4">{submission.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {submission.artifact_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={submission.artifact_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Project
                              </a>
                            </Button>
                          )}
                          {submission.video_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={submission.video_url} target="_blank" rel="noopener noreferrer">
                                <Video className="w-4 h-4 mr-2" />
                                Watch Demo
                              </a>
                            </Button>
                          )}
                        </div>
                        <Badge className="mt-4" variant={submission.status === "submitted" ? "default" : "secondary"}>
                          {submission.status.replace("_", " ").toUpperCase()}
                        </Badge>
                      </div>
                      {canSubmit && (
                        <Button variant="outline" onClick={() => toast({ title: "Update submission", description: "Feature coming soon!" })}>
                          Update Submission
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      {canSubmit ? (
                        <>
                          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground mb-4">Submit your hackathon project</p>
                          <Button onClick={() => toast({ title: "Submit project", description: "Submission form coming soon!" })}>
                            Submit Project
                          </Button>
                        </>
                      ) : (
                        <>
                          <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">
                            {!isStarted ? "Submissions will open when the hackathon starts." : "Submission deadline has passed."}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Results Tab */}
            {resultsPublished && (
              <TabsContent value="results">
                <Card>
                  <CardHeader>
                    <CardTitle>Results</CardTitle>
                    <CardDescription>Hackathon winners and rankings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Results will be displayed here once published.</p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Registration Required</h2>
              <p className="text-muted-foreground mb-4">
                {isPending 
                  ? "Your registration is pending approval. You'll be notified once approved."
                  : isRejected
                  ? "Your registration was rejected. Please contact support if you believe this is an error."
                  : "Please register for this hackathon to access the dashboard."
                }
              </p>
              {!registration && !registrationClosed && (
                <Button onClick={() => setShowRegistration(true)}>
                  Register Now
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Registration Dialog */}
      {showRegistration && hackathonId && memberId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Register for Hackathon</CardTitle>
            </CardHeader>
            <CardContent>
              <HackathonRegistration
                hackathonId={hackathonId}
                hackathonTitle={hackathon.title}
                memberId={memberId}
                paymentRequired={hackathon.payment_required || false}
                feeAmount={hackathon.fee_amount || 0}
                feeCurrency={hackathon.fee_currency || "PKR"}
                onSuccess={() => {
                  setShowRegistration(false);
                  window.location.reload(); // Reload to show updated status
                }}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

