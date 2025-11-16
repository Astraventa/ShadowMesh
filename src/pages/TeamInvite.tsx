import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CheckCircle2, AlertCircle, Users, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function TeamInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<"none" | "pending" | "approved" | "rejected" | null>(null);

  useEffect(() => {
    async function verifyInvite() {
      if (!token) {
        setError("Invalid invite link");
        setLoading(false);
        return;
      }

      try {
        // First, verify the invite link is valid (even for non-members)
        const response = await fetch(`${SUPABASE_URL}/functions/v1/team_invite?token=${token}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Invalid or expired invite link");
          setLoading(false);
          return;
        }

        // Invite is valid - show details
        setInviteData(data.invite);

        // Check if user is authenticated and is a member
        const authenticated = localStorage.getItem("shadowmesh_authenticated");
        const memberEmail = localStorage.getItem("shadowmesh_member_email");
        
        if (!authenticated || !memberEmail) {
          // Non-member: Store invite token for later, show registration prompt
          localStorage.setItem("pending_team_invite", token);
          setLoading(false);
          return;
        }

        // User is authenticated - check if they're a member
        const { data: memberData } = await supabase
          .from("members")
          .select("id")
          .eq("email", memberEmail)
          .single();

        if (!memberData) {
          // Not a member yet - store invite token, show registration prompt
          localStorage.setItem("pending_team_invite", token);
          setLoading(false);
          return;
        }

        // User is a member - check hackathon registration status
        setMemberId(memberData.id);
        
        // Check if member is registered for this hackathon
        if (data.invite?.hackathon_id) {
          const { data: regData } = await supabase
            .from("hackathon_registrations")
            .select("status")
            .eq("hackathon_id", data.invite.hackathon_id)
            .eq("member_id", memberData.id)
            .maybeSingle();
          
          if (!regData) {
            setRegistrationStatus("none");
          } else {
            setRegistrationStatus(regData.status as "pending" | "approved" | "rejected");
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error("Error verifying invite:", err);
        setError(err.message || "Failed to verify invite link");
        setLoading(false);
      }
    }

    verifyInvite();
  }, [token]);

  async function handleJoinTeam() {
    if (!memberId || !inviteData) return;

    setJoining(true);
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/team_invite?token=${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ member_id: memberId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to join team");
      }

      toast({
        title: "Successfully joined team!",
        description: `You've joined "${data.team_name}"`,
      });

      // Redirect to hackathon dashboard
      navigate(`/hackathons/${inviteData.hackathon_id}?tab=teams`);
    } catch (err: any) {
      console.error("Error joining team:", err);
      toast({
        title: "Failed to join team",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
      setJoining(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying invite link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Invalid Invite Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate("/")}
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show invite details even if user is not a member (elite approach)
  if (inviteData && !memberId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-2">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Team Invitation</CardTitle>
            <CardDescription>You've been invited to join a team!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Team Name</p>
                <p className="font-semibold text-lg">{inviteData?.team_name}</p>
              </div>
              
              {inviteData?.expires_at && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Expires
                  </p>
                  <p className="font-semibold">
                    {new Date(inviteData.expires_at).toLocaleDateString()}
                  </p>
                </div>
              )}

              {inviteData?.uses_remaining !== undefined && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Uses Remaining</p>
                  <p className="font-semibold">{inviteData.uses_remaining} / {inviteData.max_uses || 3}</p>
                </div>
              )}
            </div>

            <Alert className="border-primary/50 bg-primary/5">
              <Users className="h-4 w-4 text-primary" />
              <AlertTitle>Join ShadowMesh to Accept</AlertTitle>
              <AlertDescription>
                You need to be a ShadowMesh member to join this team. Register now and we'll automatically accept this invite once you're approved.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/")}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  // Store invite token and redirect to registration
                  localStorage.setItem("pending_team_invite", token || "");
                  navigate("/join-us?tab=register&invite=true");
                }}
              >
                <Users className="w-4 h-4 mr-2" />
                Join ShadowMesh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show registration status and appropriate action
  if (memberId && registrationStatus === "none") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-2">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Team Invitation</CardTitle>
            <CardDescription>You've been invited to join a team!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Team Name</p>
                <p className="font-semibold text-lg">{inviteData?.team_name}</p>
              </div>
            </div>

            <Alert className="border-amber-500/50 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <AlertTitle>Registration Required</AlertTitle>
              <AlertDescription>
                You need to register and be approved for this hackathon before joining teams. Register now and come back to accept this invite.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/member-portal")}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate(`/hackathons/${inviteData?.hackathon_id}`)}
              >
                Register for Hackathon
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (memberId && registrationStatus === "pending") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-2">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Team Invitation</CardTitle>
            <CardDescription>You've been invited to join a team!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Team Name</p>
                <p className="font-semibold text-lg">{inviteData?.team_name}</p>
              </div>
            </div>

            <Alert className="border-blue-500/50 bg-blue-500/5">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              <AlertTitle>Registration Pending</AlertTitle>
              <AlertDescription>
                Your hackathon registration is under review. Once approved, you can join this team. We'll notify you when your registration is approved.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/member-portal")}
              >
                Go to Portal
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate(`/hackathons/${inviteData?.hackathon_id}`)}
              >
                View Hackathon
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (memberId && registrationStatus === "rejected") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-2">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Team Invitation</CardTitle>
            <CardDescription>You've been invited to join a team!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Team Name</p>
                <p className="font-semibold text-lg">{inviteData?.team_name}</p>
              </div>
            </div>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Registration Not Approved</AlertTitle>
              <AlertDescription>
                Your hackathon registration was not approved. Please contact the admin if you believe this is an error.
              </AlertDescription>
            </Alert>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/member-portal")}
            >
              Go to Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-2">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Team Invitation</CardTitle>
          <CardDescription>You've been invited to join a team!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Team Name</p>
              <p className="font-semibold text-lg">{inviteData?.team_name}</p>
            </div>
            
            {inviteData?.expires_at && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Expires
                </p>
                <p className="font-semibold">
                  {new Date(inviteData.expires_at).toLocaleDateString()}
                </p>
              </div>
            )}

            {inviteData?.uses_remaining !== undefined && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Uses Remaining</p>
                <p className="font-semibold">{inviteData.uses_remaining} / {inviteData.max_uses || 3}</p>
              </div>
            )}
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Ready to join?</AlertTitle>
            <AlertDescription>
              Click the button below to join this team. You'll be redirected to the hackathon dashboard.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/member-portal")}
              disabled={joining}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleJoinTeam}
              disabled={joining || registrationStatus !== "approved"}
            >
              {joining ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Join Team
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

