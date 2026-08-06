import re

file_path = 'src/components/screens/MemberCartScreen.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the WebView inside the TouchableOpacity
content = re.sub(r"<WebView\n\s+ref=\{webViewRef\}\n.*?\n\s+/>", "<View style={{ flex: 1, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' }}><MapPin color=\"#10B981\" size={48} /><Text style={{ color: '#F8FAFC', marginTop: 12, fontWeight: 'bold' }}>Nhấn để xem Bản đồ 2D</Text></View>", content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done MemberCartScreen!')
