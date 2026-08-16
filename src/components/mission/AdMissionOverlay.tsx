import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

export function AdMissionOverlay({
  mission,
  status,
  activeWaypoint,
  activePlaylist,
}: {
  mission: any;
  status: string;
  activeWaypoint: any;
  activePlaylist: any[];
}) {
  if (!mission || mission.flowType !== 'ad') return null;
  const isArrived = status === 'ARRIVED';
  if (!isArrived || activePlaylist.length === 0) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <AdCarousel playlist={activePlaylist} />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ĐIỂM DỪNG QUẢNG CÁO</Text>
          <Text style={styles.title}>{activeWaypoint?.shelfName || activeWaypoint?.nodeName}</Text>
        </View>
      </View>
    </Modal>
  );
}

function AdCarousel({ playlist }: { playlist: any[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (playlist.length < 2) return;
    const duration = (playlist[index]?.durationSeconds ?? playlist[index]?.displayDurationSeconds ?? 10) * 1000;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % playlist.length), duration);
    return () => clearTimeout(timer);
  }, [index, playlist]);
  const item = playlist[index % Math.max(playlist.length, 1)];
  const media = item?.mediaContents?.[0];
  const type = String(media?.resourceType ?? '').toUpperCase();
  const url = media?.resourceUrl || item?.imageUrl || '';
  return <AdCreative type={type} url={url} title={item?.name || item?.productName || 'Ưu đãi hôm nay'} text={media?.contentText} />;
}

function AdCreative({ type, url, title, text }: { type: string; url: string; title: string; text?: string | null }) {
  const isVideo = type.includes('VIDEO') || /\.(mp4|webm|mov)(\?|$)/i.test(url);
  const player = useVideoPlayer(isVideo && url ? url : null, (instance) => {
    instance.loop = true;
    instance.play();
  });
  return (
    <View style={styles.creative}>
      {isVideo && url
        ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
        : url
          ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          : null}
      <View style={styles.creativeCaption}>
        <Text style={styles.creativeTitle}>{title}</Text>
        {!!text && <Text style={styles.creativeText}>{text}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030712' },
  header: {
    position: 'absolute',
    top: 40,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(4,14,29,0.8)',
    padding: 20,
    borderRadius: 24,
  },
  eyebrow: { color: '#6ee7b7', fontWeight: '900', letterSpacing: 2, fontSize: 14 },
  title: { color: 'white', fontSize: 28, fontWeight: '900', marginTop: 4 },
  creative: { flex: 1, justifyContent: 'flex-end' },
  creativeCaption: { 
    padding: 40, 
    paddingBottom: 60,
    backgroundColor: 'rgba(3,7,18,.85)', 
    borderTopLeftRadius: 40, 
    borderTopRightRadius: 40 
  },
  creativeTitle: { color: 'white', fontSize: 42, fontWeight: '900', marginBottom: 12 },
  creativeText: { color: '#cbd5e1', fontSize: 24, lineHeight: 36 },
});
