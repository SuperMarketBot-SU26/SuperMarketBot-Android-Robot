const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, '..', 'node_modules', '@react-native-voice', 'voice', 'android', 'build.gradle');
const manifestPath = path.join(__dirname, '..', 'node_modules', '@react-native-voice', 'voice', 'android', 'src', 'main', 'AndroidManifest.xml');

if (fs.existsSync(gradlePath)) {
  let content = fs.readFileSync(gradlePath, 'utf8');
  let modified = false;

  if (content.includes('jcenter()')) {
    content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
    modified = true;
  }

  if (!content.includes('namespace "com.wenkesj.voice"')) {
    content = content.replace(/android\s*\{/, 'android {\n    namespace "com.wenkesj.voice"');
    modified = true;
  }

  if (content.includes('com.android.support:appcompat-v7')) {
    content = content.replace(/implementation\s+["']com\.android\.support:appcompat-v7:[^"']+["']/, 'implementation "androidx.appcompat:appcompat:1.6.1"');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(gradlePath, content, 'utf8');
    console.log('Successfully patched @react-native-voice/voice build.gradle.');
  }
}

if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  let modified = false;
  if (manifest.includes('package="com.wenkesj.voice"')) {
    manifest = manifest.replace(/\s*package="com\.wenkesj\.voice"/, '');
    modified = true;
  }
  if (manifest.includes('uses-sdk tools:overrideLibrary')) {
    manifest = manifest.replace(/<uses-sdk tools:overrideLibrary="com\.facebook\.react"\s*\/>/, '');
    modified = true;
  }
  if (modified) {
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('Successfully patched @react-native-voice/voice AndroidManifest.xml.');
  }
}
