# Build APK Instructions

## Your app is ready for APK generation!

### Files created:
- `android/` folder contains your Android project
- `capacitor.config.ts` configured for Sanbitu FC
- Web assets copied to Android project

### To build APK:

#### Method 1: Android Studio (Recommended)
1. Install Android Studio
2. Run: `npx cap open android`
3. Build → Build Bundle(s) / APK(s) → Build APK(s)
4. Find APK in: `android/app/build/outputs/apk/debug/`

#### Method 2: Online Builder
1. Zip entire project folder
2. Upload to PhoneGap Build or similar service

#### Method 3: Command Line (if you have Android SDK)
```bash
cd android
./gradlew assembleDebug
```

### APK Location:
Your APK will be in: `android/app/build/outputs/apk/debug/app-debug.apk`

### App Details:
- **App Name**: Sanbitu FC
- **Package ID**: com.sanbitufc.app
- **Platform**: Android
- **Type**: Hybrid (Web + Native)