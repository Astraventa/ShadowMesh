import { useState } from "react";
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Upload, Loader2 } from "lucide-react";

interface EventRegistrationProps {
  eventId: string;
  eventTitle: string;
  memberId: string;
  paymentRequired: boolean;
  feeAmount: number;
  feeCurrency: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EventRegistration({
  eventId,
  eventTitle,
  memberId,
  paymentRequired,
  feeAmount,
  feeCurrency,
  onSuccess,
  onCancel,
}: EventRegistrationProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!memberId) {
      toast({ title: "Error", description: "Member ID is required." });
      return;
    }

    // Validate payment fields if payment is required
    if (paymentRequired) {
      if (!paymentMethod) {
        toast({ title: "Payment Required", description: "Please select a payment method." });
        return;
      }
      if (!transactionId.trim()) {
        toast({ title: "Transaction ID Required", description: "Please enter your transaction ID." });
        return;
      }
      if (!paymentProof) {
        toast({ title: "Payment Proof Required", description: "Please upload a screenshot of your payment." });
        return;
      }
    }

    setLoading(true);
    try {
      let paymentProofUrl: string | null = null;

      // Upload payment proof if provided
      if (paymentProof) {
        setUploading(true);
        const fileExt = paymentProof.name.split(".").pop();
        const fileName = `${memberId}_${eventId}_${Date.now()}.${fileExt}`;
        const filePath = `event-payments/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("Payment-Proofs")
          .upload(filePath, paymentProof);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("Payment-Proofs")
          .getPublicUrl(filePath);

        paymentProofUrl = publicUrl;
        setUploading(false);
      }

      // Register for event
      const registrationData: any = {
        event_id: eventId,
        member_id: memberId,
        status: "registered",
        notes: notes.trim() || null,
      };

      // Add payment fields if payment is required
      if (paymentRequired) {
        registrationData.payment_method = paymentMethod;
        registrationData.transaction_id = transactionId.trim();
        registrationData.payment_amount = feeAmount;
        registrationData.payment_proof_url = paymentProofUrl;
        registrationData.payment_date = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();
      }

      const { error } = await supabase
        .from("event_registrations")
        .insert([registrationData]);

      if (error) throw error;

      toast({
        title: "Registration Successful!",
        description: paymentRequired
          ? "Your registration is pending payment verification. We'll notify you once approved."
          : "You've successfully registered for this event.",
      });

      // Call onSuccess with eventId to refresh data
      onSuccess();
    } catch (e: any) {
      console.error("Registration error:", e);
      toast({
        title: "Registration Failed",
        description: e.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Register for {eventTitle}</h3>
        {paymentRequired && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-md space-y-3">
            <p className="text-sm text-yellow-400">
              <strong>Payment Required:</strong> {feeAmount} {feeCurrency}
            </p>
            <div className="bg-background/50 p-3 rounded border border-border/50">
              <p className="text-xs font-semibold mb-2 text-foreground">Bank Transfer Details:</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><strong className="text-foreground">Account Name:</strong> Zeeshan</p>
                <p><strong className="text-foreground">IBAN:</strong> PK08 MEZN 0000 3001 1288 7110</p>
                <p><strong className="text-foreground">Account Number:</strong> 0030 0112887110</p>
                <p><strong className="text-foreground">Bank:</strong> Meezan Bank</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Please transfer {feeAmount} {feeCurrency} to the account above and upload proof below.
            </p>
          </div>
        )}
      </div>

      {paymentRequired && (
        <>
          <div>
            <Label htmlFor="payment_method">Payment Method <span className="text-destructive">*</span></Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} required>
              <SelectTrigger id="payment_method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="easypaisa">Easypaisa</SelectItem>
                <SelectItem value="jazzcash">JazzCash</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="transaction_id">Transaction ID / Reference Number <span className="text-destructive">*</span></Label>
            <Input
              id="transaction_id"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter transaction ID"
              required
            />
          </div>

          <div>
            <Label htmlFor="payment_date">Payment Date</Label>
            <Input
              id="payment_date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          <div>
            <Label htmlFor="payment_proof">Payment Proof (Screenshot) <span className="text-destructive">*</span></Label>
            <div className="mt-2">
              <Input
                id="payment_proof"
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
                  }
                }}
                required
              />
              {paymentProof && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: {paymentProof.name}
                </p>
              )}
            </div>
          </div>
        </>
      )}

      <div>
        <Label htmlFor="notes">Additional Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional information..."
          rows={3}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={loading || uploading}>
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Registering...
            </>
          ) : (
            "Register"
          )}
        </Button>
      </div>
    </form>
  );
}

