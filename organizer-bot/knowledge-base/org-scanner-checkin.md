## Scanner & Check-in

### Scanner PWA

Access via: `/scanner` or scan QR code from Scanning Areas

#### Scanner Setup
1. Go to Scanning Areas page
2. Click "Assign Stations"
3. Scan QR code with device
4. Wait for admin approval
5. Start scanning tickets

#### Scanning Process
1. Open scanner on device
2. Point camera at QR code
3. System validates ticket
4. Shows check-in result:
   - **Success**: Green screen
   - **Already Checked In**: Yellow warning
   - **Invalid**: Red error

### Offline Support
- Scanner works offline
- Queues scans when disconnected
- Syncs when connection restored

### Batch Check-in
- Bulk check-in via CSV upload
- Useful for pre-checked attendees
- Admin-only feature

### Scanner Features
| Feature | Description |
|---------|-------------|
| **Camera Scanning** | Use device camera |
| **Manual Entry** | Type ticket code |
| **Scan History** | View recent scans |
| **Offline Mode** | Works without internet |
