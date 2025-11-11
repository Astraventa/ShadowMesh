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

  useEffect(() => {
    async function verifyInvite() {
      if (!token) {
        setError("Invalid invite link");
        setLoading(false);
        return;
      }

      try {
        // Check if user is authenticated
        const authenticated = localStorage.getItem("shadowmesh_authenticated");
        const memberEmail = localStorage.getItem("shadowmesh_member_email");
        
        if (!authenticated || !memberEmail) {
          setError("Please log in to join the team");
          setLoading(false);
          return;
        }

        // Get member ID
        const { data: memberData } = await supabase
          .from("members")
          .select("id")
          .eq("email", memberEmail)
          .single();

        if (!memberData) {
          setError("Member not found. Please log in again.");
          setLoading(false);
          return;
        }

        setMemberId(memberData.id);

        // Verify invite via edge function
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

        setInviteData(data.invite);
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
              onClick={() => navigate("/member-portal")}
            >
              Go to Member Portal
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
              disabled={joining}
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

