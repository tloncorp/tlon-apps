import Lightbox from '@/components/LightBox';

export default function LightboxFixture() {
  return (
    <Lightbox showLightBox={true} setShowLightBox={() => null}>
      Here's where the lightbox content would be.
    </Lightbox>
  );
}
