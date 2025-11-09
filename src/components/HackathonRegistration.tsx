import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabaseClient";
import { Upload, X } from "lucide-react";

interface HackathonRegistrationProps {
  hackathonId: string;
  hackathonTitle: string;
  memberId: string;
  paymentRequired: boolean;
  feeAmount?: number;
  feeCurrency?: string;
  onSuccess?: () => void;
}

export default function HackathonRegistration({
  hackathonId,
  hackathonTitle,
  memberId,
  paymentRequired,
  feeAmount = 0,
  feeCurrency = "PKR",
  onSuccess,
}: HackathonRegistrationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null);
  const [areaOfInterest, setAreaOfInterest] = useState("");
  const [notes, setNotes] = useState("");

  async function handleFileUpload(file: File): Promise<string | null> {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${memberId}_${Date.now()}.${fileExt}`;
      const filePath = `hackathon-payments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("Payment-Proofs")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("Payment-Proofs").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message });
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    // Validate payment fields only if payment is required
    if (paymentRequired) {
      if (!paymentMethod || !transactionId || !paymentAmount) {
        toast({ title: "Missing fields", description: "Please fill all required payment fields." });
        return;
      }
    }

    // Validate area of interest for non-payment hackathons
    if (!paymentRequired && !areaOfInterest) {
      toast({ title: "Area of interest required", description: "Please select your area of interest for team matching." });
      return;
    }

    setLoading(true);
    try {
      let proofUrl = paymentProofUrl;
      if (paymentRequired && paymentProof && !proofUrl) {
        proofUrl = await handleFileUpload(paymentProof);
        if (!proofUrl) {
          setLoading(false);
          return;
        }
      }

      const registrationData: any = {
        member_id: memberId,
        hackathon_id: hackathonId,
        notes: notes || null,
        status: paymentRequired ? "pending" : "approved", // Auto-approve if no payment required
      };

      // Add payment fields only if payment is required
      if (paymentRequired) {
        registrationData.payment_method = paymentMethod;
        registrationData.transaction_id = transactionId;
        registrationData.payment_amount = parseFloat(paymentAmount);
        registrationData.payment_date = paymentDate || new Date().toISOString();
        registrationData.payment_proof_url = proofUrl;
      }

      const { error } = await supabase.from("hackathon_registrations").insert(registrationData);

      if (error) throw error;

      // Update member's area of interest if provided (for team matching)
      if (!paymentRequired && areaOfInterest) {
        await supabase
          .from("members")
          .update({ area_of_interest: areaOfInterest })
          .eq("id", memberId);
      }

      // Log activity
      await supabase.from("member_activity").insert({
        member_id: memberId,
        activity_type: paymentRequired ? "hackathon_registered" : "hackathon_approved",
        activity_data: { hackathon_id: hackathonId, hackathon_title: hackathonTitle },
        related_id: hackathonId,
      });

      toast({ 
        title: "Registration submitted", 
        description: paymentRequired 
          ? "Your hackathon registration is pending admin approval." 
          : "You've been automatically approved! You can now create or join a team." 
      });
      onSuccess?.();
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message || "Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register for {hackathonTitle}</CardTitle>
        <CardDescription>
          {paymentRequired 
            ? "Complete payment and submit proof to register" 
            : "Register to participate in this hackathon"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {paymentRequired ? (
            <>
              {feeAmount > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
                  <p className="text-sm text-yellow-400">
                    <strong>Payment Required:</strong> {feeAmount} {feeCurrency}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Payment Method <span className="text-destructive">*</span></label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easypaisa">Easypaisa</SelectItem>
                    <SelectItem value="jazzcash">JazzCash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Transaction ID / Reference <span className="text-destructive">*</span></label>
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter transaction reference number"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payment Amount ({feeCurrency}) <span className="text-destructive">*</span></label>
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payment Date</label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payment Proof (Screenshot/Receipt) <span className="text-destructive">*</span></label>
                {paymentProofUrl ? (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-sm flex-1">Proof uploaded</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPaymentProof(null);
                        setPaymentProofUrl(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 5 * 1024 * 1024) {
                            toast({
                              title: "File too large",
                              description: "Please upload a file smaller than 5MB.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setPaymentProof(file);
                          const reader = new FileReader();
                          reader.onload = () => setPaymentProofUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="flex-1"
                      required
                    />
                    <Upload className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Area of Interest <span className="text-destructive">*</span></label>
              <Select value={areaOfInterest} onValueChange={setAreaOfInterest} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select your area of interest" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AI">AI / Machine Learning</SelectItem>
                  <SelectItem value="Cyber">Cybersecurity</SelectItem>
                  <SelectItem value="Both">Both (AI × Cyber)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">This helps us match you with compatible teammates.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Additional Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : paymentRequired ? "Submit Registration" : "Register for Hackathon"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

