import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Text } from 'react-native';
import WebView from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Maximize2, Minimize2 } from 'lucide-react-native';
import { MAP_HTML } from '../map/mapHtml';

export default function RobotMap3DScreen() {
  const webViewRef = useRef<any>(null);
  const { routeData } = useLocalSearchParams();
  const router = useRouter();
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleBack = () => {
    router.back();
    return true;
  };
  const FIXED_NODE_MAP: { [id: number]: { x: number; y: number; name: string } } = {
    1:  { x: 1.375, y: 3.00, name: "Cổng vào (Door Entrance)" },
    2:  { x: 2.100, y: 2.45, name: "Quầy Thu Ngân (Cashier Desk)" },
    3:  { x: 0.480, y: 0.48, name: "Khúc cua Trên-Trái (Zone 2)" },
    4:  { x: 2.450, y: 0.48, name: "Khúc cua Trên-Phải (Zone 1)" },
    5:  { x: 2.450, y: 2.00, name: "Ngã rẽ Chính Bên Phải" },
    6:  { x: 0.800, y: 0.48, name: "Node Kệ 2-Top (Green Horizontal)" },
    7:  { x: 0.480, y: 0.80, name: "Node Kệ 2-Left (Green Vertical)" },
    8:  { x: 2.180, y: 0.48, name: "Node Kệ 1-Top (Blue Horizontal)" },
    9:  { x: 2.450, y: 0.80, name: "Node Kệ 1-Right (Blue Vertical)" },
    10: { x: 0.480, y: 2.12, name: "Node Kệ 3-Left (Yellow Vertical)" },
    11: { x: 0.800, y: 2.50, name: "Node Kệ 3-Bottom (Yellow Horizontal)" },
    12: { x: 0.480, y: 2.50, name: "Khúc cua Dưới Góc Kệ 3" },
    13: { x: 1.280, y: 2.50, name: "Ngoặt Bậc Thang Dưới Kệ 3" },
    14: { x: 1.280, y: 2.00, name: "Ngoặt Bậc Thang Trên Kệ 3" },
    15: { x: 1.080, y: 2.00, name: "Góc Dưới-Trái Vòng Kệ 4" },
    16: { x: 1.080, y: 1.45, name: "Node Kệ 4-Left (Red Center Left)" },
    17: { x: 1.080, y: 0.85, name: "Góc Trên-Trái Vòng Kệ 4" },
    18: { x: 1.920, y: 0.85, name: "Góc Trên-Phải Vòng Kệ 4" },
    19: { x: 1.920, y: 1.45, name: "Node Kệ 4-Right (Red Center Right)" },
    20: { x: 1.920, y: 2.00, name: "Góc Dưới-Phải Vòng Kệ 4" },
    21: { x: 2.800, y: 2.00, name: "Trạm sạc / Khởi đầu (Dock ○)" }
  };

  const NODE_CONNECTIONS: { [id: number]: number[] } = {
    1:  [13, 14, 2],
    2:  [1, 20, 5, 21],
    3:  [6, 7],
    4:  [8, 9],
    5:  [4, 9, 20, 21, 2],
    6:  [3, 8],
    7:  [3, 10],
    8:  [6, 4],
    9:  [4, 5],
    10: [7, 12],
    11: [12, 13],
    12: [10, 11],
    13: [11, 14, 1],
    14: [13, 15, 20, 1],
    15: [14, 16],
    16: [15, 17],
    17: [16, 18],
    18: [17, 19],
    19: [18, 20],
    20: [19, 14, 5, 2],
    21: [5, 2]
  };

  const findBfsNodePath = (startId: number, targetId: number): number[] => {
    if (startId === targetId) return [startId];
    const queue: number[][] = [[startId]];
    const visited = new Set<number>([startId]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const curr = path[path.length - 1];
      const neighbors = NODE_CONNECTIONS[curr] || [];
      for (const neighbor of neighbors) {
        if (neighbor === targetId) {
          return [...path, neighbor];
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    return [startId, targetId];
  };

  const expandWaypointsGraph = (waypoints: any[]): any[] => {
    if (!waypoints || waypoints.length < 2) return waypoints;
    const result: any[] = [waypoints[0]];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const w1 = waypoints[i];
      const w2 = waypoints[i + 1];
      const id1 = w1.nodeId ?? w1.node_id;
      const id2 = w2.nodeId ?? w2.node_id;

      if (id1 !== undefined && id2 !== undefined && FIXED_NODE_MAP[id1] && FIXED_NODE_MAP[id2] && id1 !== id2) {
        const nodePath = findBfsNodePath(id1, id2);
        for (let k = 1; k < nodePath.length; k++) {
          const nid = nodePath[k];
          const fixed = FIXED_NODE_MAP[nid];
          const isEndNode = (k === nodePath.length - 1);
          result.push({
            ...(isEndNode ? w2 : {}),
            x: fixed.x,
            y: fixed.y,
            nodeId: nid,
            productName: isEndNode ? (w2.productName || w2.description || fixed.name) : fixed.name,
            nodeName: fixed.name
          });
        }
      } else {
        result.push(w2);
      }
    }
    return result;
  };

  const HARDCODED_MASTER_ROUTE = [
    { x: 2.80, y: 2.00, productName: "Trạm sạc D01 (n-dock)", nodeName: "D01", nodeId: 21 },
    { x: 2.45, y: 2.00, productName: "Ngã rẽ chính C03 (c-bright)", nodeName: "C03", nodeId: 5 },
    { x: 2.45, y: 0.80, productId: 1, productName: "Kệ 1-Right S04 (Bánh kẹo B)", nodeName: "S04", nodeId: 9 },
    { x: 2.45, y: 0.48, productName: "Khúc cua C02 (c-tright)", nodeName: "C02", nodeId: 4 },
    { x: 2.18, y: 0.48, productId: 2, productName: "Kệ 1-Top S03 (Đồ uống A)", nodeName: "S03", nodeId: 8 },
    { x: 0.80, y: 0.48, productId: 3, productName: "Kệ 2-Top S01 (Nông sản A)", nodeName: "S01", nodeId: 6 },
    { x: 0.48, y: 0.48, productName: "Khúc cua C01 (c-tleft)", nodeName: "C01", nodeId: 3 },
    { x: 0.48, y: 0.80, productId: 4, productName: "Kệ 2-Left S02 (Nông sản B)", nodeName: "S02", nodeId: 7 },
    { x: 0.48, y: 2.12, productId: 5, productName: "Kệ 3-Left S05 (Hóa mỹ phẩm A)", nodeName: "S05", nodeId: 10 },
    { x: 0.48, y: 2.50, productName: "Khúc cua C08 (c-z3-bot-left)", nodeName: "C08", nodeId: 12 },
    { x: 0.80, y: 2.50, productId: 6, productName: "Kệ 3-Bottom S06 (Hóa mỹ phẩm B)", nodeName: "S06", nodeId: 11 },
    { x: 1.28, y: 2.50, productName: "Ngoặt C09 (c-z3-bot-right)", nodeName: "C09", nodeId: 13 },
    { x: 1.28, y: 2.00, productName: "Ngoặt C10 (c-z3-step-top)", nodeName: "C10", nodeId: 14 },
    { x: 1.08, y: 2.00, productName: "Góc C06 (c-s4-bot-left)", nodeName: "C06", nodeId: 15 },
    { x: 1.08, y: 1.45, productId: 7, productName: "Kệ 4-Left S07 (Kệ Đỏ Trái)", nodeName: "S07", nodeId: 16 },
    { x: 1.08, y: 0.85, productName: "Góc C04 (c-s4-top-left)", nodeName: "C04", nodeId: 17 },
    { x: 1.92, y: 0.85, productName: "Góc C05 (c-s4-top-right)", nodeName: "C05", nodeId: 18 },
    { x: 1.92, y: 1.45, productId: 8, productName: "Kệ 4-Right S08 (Kệ Đỏ Phải)", nodeName: "S08", nodeId: 19 },
    { x: 1.92, y: 2.00, productName: "Góc C07 (c-s4-bot-right)", nodeName: "C07", nodeId: 20 },
    { x: 2.10, y: 2.45, productName: "Quầy Thu Ngân (Cashier Desk)", nodeName: "Checkout", nodeId: 2 }
  ];

  const sendRouteToWebView = () => {
    try {
      const parsedData = { waypoints: HARDCODED_MASTER_ROUTE };
      const jsCode = `
        if (window.setRouteData) {
          window.setRouteData(${JSON.stringify(parsedData)});
        } else if (window.visualize3DRoute) {
          window.visualize3DRoute(${JSON.stringify(parsedData)});
        }
        true;
      `;
      webViewRef.current?.injectJavaScript(jsCode);
    } catch (e) {
      console.error('Error sending route to webview:', e);
    }
  };

  useEffect(() => {
    if (isLoaded && routeData) {
      sendRouteToWebView();
    }
  }, [isLoaded, routeData]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F17" />

      {/* Header bar controls (Hidden in full screen mode for maximum map space) */}
      {!isFullScreen && (
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleBack}>
            <ChevronLeft color="white" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bản Đồ Siêu Thị 3D</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setIsFullScreen(true)}>
            <Maximize2 color="white" size={20} />
          </TouchableOpacity>
        </View>
      )}

      {/* Floating Exit Fullscreen Button */}
      {isFullScreen && (
        <TouchableOpacity style={styles.floatingExitBtn} onPress={() => setIsFullScreen(false)}>
          <Minimize2 color="white" size={24} />
        </TouchableOpacity>
      )}

      {/* Three.js WebGL 3D Map View */}
      <View style={styles.mapContainer}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: MAP_HTML, baseUrl: 'http://localhost:5000' }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
          onLoadEnd={() => {
            setIsLoaded(true);
            if (routeData) {
              setTimeout(sendRouteToWebView, 500);
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F17'
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0B0F17',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    zIndex: 20
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800'
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  floatingExitBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 100,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  mapContainer: {
    flex: 1
  },
  webView: {
    flex: 1,
    backgroundColor: '#0B0F17'
  }
});
