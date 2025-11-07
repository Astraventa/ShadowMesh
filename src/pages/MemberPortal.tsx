import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Calendar, BookOpen, ExternalLink, Download, Video, Link as LinkIcon, FileText } from "lucide-react";

interface Member {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  cohort?: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  location?: string;
  registration_link?: string;
  max_participants?: number;
  is_member_only: boolean;
}

interface Resource {
  id: string;
  title: string;
  description?: string;
  resource_type: string;
  content_url?: string;
  access_level: string;
}

export default function MemberPortal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<Member | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check if user has verification token
    const token = new URLSearchParams(window.location.search).get("token") || 
                  localStorage.getItem("shadowmesh_member_token");
    
    if (!token) {
      toast({ title: "Access Denied", description: "Please use your verification token to access the member portal." });
      navigate("/join-us");
      return;
    }

    loadMemberData(token);
  }, []);

  async function loadMemberData(token: string) {
    setLoading(true);
    try {
      // Verify token and get member info
      const verifyRes = await fetch(`${SUPABASE_URL}/functions/v1/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_token: token }),
      });

      if (!verifyRes.ok) {
        throw new Error("Invalid token");
      }

      const verifyData = await verifyRes.json();
      if (verifyData.status !== "approved") {
        throw new Error("Your application is not approved yet");
      }

      // Get member details
      const { data: memberData, error: memberError } = await supabase
        .from("members")
        .select("*")
        .eq("email", verifyData.email)
        .single();

      if (memberError || !memberData) {
        throw new Error("Member not found");
      }

      setMember(memberData);
      localStorage.setItem("shadowmesh_member_token", token);

      // Load events
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .eq("is_active", true)
        .gte("start_date", new Date().toISOString())
        .order("start_date", { ascending: true });

      if (eventsData) setEvents(eventsData);

      // Load resources
      const { data: resourcesData } = await supabase
        .from("member_resources")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (resourcesData) setResources(resourcesData);

      // Load registered events
      const { data: registrations } = await supabase
        .from("event_registrations")
        .select("event_id")
        .eq("member_id", memberData.id)
        .eq("status", "registered");

      if (registrations) {
        setRegisteredEvents(new Set(registrations.map((r: any) => r.event_id)));
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to load member data" });
      navigate("/join-us");
    } finally {
      setLoading(false);
    }
  }

  async function registerForEvent(eventId: string) {
    if (!member) return;

    try {
      const { error } = await supabase
        .from("event_registrations")
        .insert({
          event_id: eventId,
          member_id: member.id,
          status: "registered",
        });

      if (error) throw error;

      setRegisteredEvents((prev) => new Set([...prev, eventId]));
      toast({ title: "Registered!", description: "You've successfully registered for this event." });
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message || "Please try again." });
    }
  }

  function getResourceIcon(type: string) {
    switch (type) {
      case "video": return <Video className="w-5 h-5" />;
      case "download": return <Download className="w-5 h-5" />;
      case "link": return <LinkIcon className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading member portal...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Welcome, {member.full_name}!</h1>
          <p className="text-muted-foreground">ShadowMesh Member Portal</p>
        </div>

        <Tabs defaultValue="events" className="space-y-6">
          <TabsList>
            <TabsTrigger value="events">Upcoming Events</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          {/* Events Tab */}
          <TabsContent value="events">
            <div className="grid gap-6 md:grid-cols-2">
              {events.length === 0 ? (
                <Card className="col-span-2">
                  <CardContent className="py-12 text-center">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No upcoming events at the moment.</p>
                    <p className="text-sm text-muted-foreground mt-2">Check back soon for workshops, hackathons, and meetups!</p>
                  </CardContent>
                </Card>
              ) : (
                events.map((event) => (
                  <Card key={event.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle>{event.title}</CardTitle>
                          <CardDescription className="mt-1">
                            <Badge variant="outline" className="mr-2">{event.event_type}</Badge>
                            {formatDate(event.start_date)}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {event.description && <p className="text-sm text-muted-foreground mb-4">{event.description}</p>}
                      {event.location && <p className="text-sm mb-2"><strong>Location:</strong> {event.location}</p>}
                      {event.max_participants && (
                        <p className="text-sm text-muted-foreground mb-4">
                          Max participants: {event.max_participants}
                        </p>
                      )}
                      <div className="flex gap-2 mt-4">
                        {registeredEvents.has(event.id) ? (
                          <Badge variant="secondary" className="flex-1 justify-center">Registered</Badge>
                        ) : (
                          <>
                            <Button
                              variant="default"
                              className="flex-1"
                              onClick={() => registerForEvent(event.id)}
                            >
                              Register
                            </Button>
                            {event.registration_link && (
                              <Button variant="outline" asChild>
                                <a href={event.registration_link} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  More Info
                                </a>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {resources.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-12 text-center">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No resources available at the moment.</p>
                  </CardContent>
                </Card>
              ) : (
                resources.map((resource) => (
                  <Card key={resource.id}>
                    <CardHeader>
                      <div className="flex items-center gap-2 mb-2">
                        {getResourceIcon(resource.resource_type)}
                        <CardTitle className="text-lg">{resource.title}</CardTitle>
                      </div>
                      <CardDescription>
                        <Badge variant="outline">{resource.resource_type}</Badge>
                        {resource.access_level === "premium" && (
                          <Badge variant="secondary" className="ml-2">Premium</Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {resource.description && (
                        <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
                      )}
                      {resource.content_url && (
                        <Button variant="outline" className="w-full" asChild>
                          <a href={resource.content_url} target="_blank" rel="noopener noreferrer">
                            {resource.resource_type === "download" ? (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </>
                            ) : (
                              <>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open
                              </>
                            )}
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Member Profile</CardTitle>
                <CardDescription>Your ShadowMesh membership information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                  <p className="text-lg">{member.full_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-lg">{member.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Member Since</label>
                  <p className="text-lg">{formatDate(member.created_at)}</p>
                </div>
                {member.cohort && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Cohort</label>
                    <p className="text-lg">{member.cohort}</p>
                  </div>
                )}
                <div className="pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    localStorage.removeItem("shadowmesh_member_token");
                    navigate("/");
                  }}>
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

