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
  onSuccess?: () => void;
}

export default function HackathonRegistration({
  hackathonId,
  hackathonTitle,
  memberId,
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

    if (!paymentMethod || !transactionId || !paymentAmount) {
      toast({ title: "Missing fields", description: "Please fill all required payment fields." });
      return;
    }

    setLoading(true);
    try {
      let proofUrl = paymentProofUrl;
      if (paymentProof && !proofUrl) {
        proofUrl = await handleFileUpload(paymentProof);
        if (!proofUrl) {
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.from("hackathon_registrations").insert({
        member_id: memberId,
        hackathon_id: hackathonId,
        payment_method: paymentMethod,
        transaction_id: transactionId,
        payment_amount: parseFloat(paymentAmount),
        payment_date: paymentDate || new Date().toISOString(),
        payment_proof_url: proofUrl,
        notes: notes || null,
        status: "pending",
      });

      if (error) throw error;

      // Log activity
      await supabase.from("member_activity").insert({
        member_id: memberId,
        activity_type: "hackathon_registered",
        activity_data: { hackathon_id: hackathonId, hackathon_title: hackathonTitle },
        related_id: hackathonId,
      });

      toast({ title: "Registration submitted", description: "Your hackathon registration is pending admin approval." });
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
        <CardDescription>Complete payment and submit proof to register</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Payment Method *</label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
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
            <label className="block text-sm font-medium mb-2">Transaction ID / Reference *</label>
            <Input
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter transaction reference number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payment Amount (PKR) *</label>
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Payment Proof (Screenshot/Receipt)</label>
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
                      setPaymentProof(file);
                      const reader = new FileReader();
                      reader.onload = () => setPaymentProofUrl(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="flex-1"
                />
                <Upload className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Additional Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : "Submit Registration"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

