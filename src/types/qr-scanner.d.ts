declare module "@yudiel/react-qr-scanner" {
	import * as React from "react";

	type Constraints = MediaStreamConstraints["video"];

	export interface QrScannerProps {
		onDecode?: (result: string) => void;
		onError?: (error: Error) => void;
		constraints?: Constraints;
		containerStyle?: React.CSSProperties;
		videoStyle?: React.CSSProperties;
	}

	export const QrScanner: React.FC<QrScannerProps>;
	const DefaultQrScanner: React.FC<QrScannerProps>;
	export default DefaultQrScanner;
}

