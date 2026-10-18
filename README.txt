MOTION 3D — NO-NODE LOCAL PROTOTYPE (UPDATED)
=============================================

TECH STACK
- HTML, CSS and vanilla JavaScript
- Native WebGL renderer (actual 3D geometry)
- Python 3 standard-library server only
- No Node.js, npm, pip packages, React, or external 3D libraries required.

START ON WINDOWS
1. Extract this ZIP.
2. Double-click START_MOTION_3D.bat.
3. On the PC, open http://127.0.0.1:8000
4. The server window also prints the PC's Wi-Fi/LAN URL.

3D OBJECT BEHAVIOUR
- Choosing a primitive replaces the currently selected object instead of stacking another object.
- Import accepts 3D models only: OBJ and STL (ASCII or binary STL).
- The imported model replaces the previous active object.
- JPG/PNG/WebP photo uploads are disabled in this version.
- Object transforms and material controls affect the live WebGL object.
- Export scene downloads a JSON scene description.

CONNECTING A PHONE FROM LOCALHOST
Important: localhost always means "this same device".
If the PC opens http://127.0.0.1:8000, a phone scanning that URL will try to connect to itself, not the PC.

Option A — same Wi-Fi LAN:
1. Connect PC and phone to the same Wi-Fi.
2. Start the BAT file.
3. Use the LAN URL printed in the terminal, like http://192.168.x.x:8000.
4. Allow Python through Windows Firewall on Private networks if Windows asks.
5. Create a QR code in the PC app and scan it on the phone.
This allows the phone to reach the PC server. However, many mobile browsers only expose device motion sensors on HTTPS secure contexts. If motion permission is unavailable over LAN HTTP, use Option B.

Option B — HTTPS tunnel:
Use a trusted HTTPS tunnel tool that you choose and trust, or deploy the app on a host with HTTPS. Open the HTTPS URL on the PC, then create the pairing QR from that origin. Do not expose a development server publicly without understanding its security implications. This project has no account login, so treat pairing links as private.

PHONE-TO-PHONE
The session controller URL can be opened on another phone as long as both phones can reach the same server URL. In this prototype the shared session stores the latest orientation sample, so if multiple phones send motion at once, the most recent update wins. For reliable phone-to-phone use, one device must still host/reach the Python server (normally a PC or LAN host); two phones using their own localhost addresses cannot find each other automatically.

QR NOTE
The app requests a QR image from an online QR rendering service for convenience. The actual pairing URL is also displayed and can be copied. QR image generation therefore needs internet access; the rest of the app can run locally.

SECURITY AND LIMITATIONS
- The server binds to all network interfaces for LAN pairing. Only run it on a trusted network.
- The pairing token expires after 30 minutes.
- This is a prototype, not production-grade public hosting.
- Motion sensor permission depends on phone OS/browser and often requires HTTPS.
- Browser motion control has been implemented but should be tested on the actual target phone.
