import {
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type Crop,
  type Size,
  avatarRadiusRatio,
  avatarSizes,
  centeredCrop,
  clampCrop,
  imageScale,
  maxZoom,
  outputSize,
  sourceRect,
  zoomCrop,
} from './avatarCrop';

export type AvatarUpload = { avatar: string; avatarType: 'image/jpeg' };

type Source = { image: HTMLImageElement; url: string };

const cropSize = 240;
const margin = 16;
const stageSize = cropSize + margin * 2;
const muted: CSSProperties = { opacity: 0.7, fontSize: 14 };

/**
 * The avatar slot of the new identity form: pick or drop an image, crop it,
 * and get back a 512px JPEG.
 */
export function AvatarPicker({
  disabled,
  onChange,
  onError,
}: {
  disabled: boolean;
  onChange: (avatar: AvatarUpload) => void;
  onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<{
    source: Source;
    crop: Crop;
    preview: string;
  }>();
  const [editing, setEditing] = useState<{ source: Source; crop?: Crop }>();
  const [dragging, setDragging] = useState(false);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const created = urls.current;
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function discard(source: Source) {
    URL.revokeObjectURL(source.url);
    urls.current.delete(source.url);
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    onError('');
    try {
      const source = await loadImage(file);
      urls.current.add(source.url);
      if (editing && editing.source !== chosen?.source) discard(editing.source);
      setEditing({ source });
    } catch (cause) {
      // Close the cropper so the message shows on the form.
      setEditing(undefined);
      onError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) void choose(event.dataTransfer.files[0]);
  }

  const preview = chosen?.preview;
  const size = avatarSizes[1];
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={preview ? 'Change profile picture' : 'Add profile picture'}
        onClick={() =>
          chosen
            ? setEditing({ source: chosen.source, crop: chosen.crop })
            : input.current?.click()
        }
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        style={{
          flex: 'none',
          width: size.size,
          height: size.size,
          borderRadius: size.radius,
          padding: 0,
          overflow: 'hidden',
          cursor: disabled ? 'default' : 'pointer',
          font: 'inherit',
          fontSize: 13,
          color: 'inherit',
          background: preview
            ? 'transparent'
            : 'color-mix(in srgb, CanvasText 6%, Canvas)',
          border: preview
            ? 'none'
            : `1.5px dashed color-mix(in srgb, CanvasText ${dragging ? 80 : 35}%, Canvas)`,
          outline: dragging && preview ? '2px solid CanvasText' : undefined,
          outlineOffset: 2,
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            width={size.size}
            height={size.size}
            style={{ display: 'block' }}
          />
        ) : (
          <span style={{ display: 'grid', gap: 2, placeItems: 'center' }}>
            <span aria-hidden style={{ fontSize: 22, lineHeight: 1 }}>
              +
            </span>
            Add photo
          </span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void choose(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {editing && (
        <AvatarCropper
          key={editing.source.url}
          source={editing.source}
          initialCrop={editing.crop}
          onChooseAnother={() => input.current?.click()}
          onCancel={() => {
            setEditing(undefined);
            if (editing.source !== chosen?.source) discard(editing.source);
          }}
          onDone={(crop, dataUrl) => {
            if (chosen && chosen.source !== editing.source)
              discard(chosen.source);
            setChosen({ source: editing.source, crop, preview: dataUrl });
            setEditing(undefined);
            onChange({
              avatar: dataUrl.slice(dataUrl.indexOf(',') + 1),
              avatarType: 'image/jpeg',
            });
          }}
        />
      )}
    </>
  );
}

async function loadImage(file: File): Promise<Source> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`${file.name} isn't an image this browser can open.`);
  }
  return { image, url };
}

function AvatarCropper({
  source,
  initialCrop,
  onChooseAnother,
  onCancel,
  onDone,
}: {
  source: Source;
  initialCrop?: Crop;
  onChooseAnother: () => void;
  onCancel: () => void;
  onDone: (crop: Crop, dataUrl: string) => void;
}) {
  const image: Size = useMemo(
    () => ({
      width: source.image.naturalWidth,
      height: source.image.naturalHeight,
    }),
    [source]
  );
  const [crop, setCrop] = useState(
    () => initialCrop ?? centeredCrop(image, cropSize)
  );
  const stage = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    stage.current?.focus();
  }, []);

  // React registers wheel listeners as passive, so zooming the page would win.
  useEffect(() => {
    const element = stage.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const focus = cropPoint(element, event.clientX, event.clientY);
      setCrop((current) =>
        zoomCrop(
          current,
          current.zoom * Math.exp(-event.deltaY * 0.002),
          focus,
          image,
          cropSize
        )
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [image]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setGrabbing(true);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = pointers.current;
    const previous = active.get(event.pointerId);
    if (!previous) return;
    const before = [...active.values()];
    active.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = [...active.values()];
    if (after.length === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      setCrop((current) =>
        clampCrop(
          { ...current, x: current.x + dx, y: current.y + dy },
          image,
          cropSize
        )
      );
      return;
    }
    // Two fingers: pan with their midpoint and zoom with their spread.
    const [a0, b0] = before;
    const [a1, b1] = after;
    const spread = Math.hypot(b1.x - a1.x, b1.y - a1.y);
    const previousSpread = Math.hypot(b0.x - a0.x, b0.y - a0.y);
    const middle = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
    const dx = middle.x - (a0.x + b0.x) / 2;
    const dy = middle.y - (a0.y + b0.y) / 2;
    const focus = cropPoint(event.currentTarget, middle.x, middle.y);
    setCrop((current) =>
      zoomCrop(
        { ...current, x: current.x + dx, y: current.y + dy },
        current.zoom * (previousSpread ? spread / previousSpread : 1),
        focus,
        image,
        cropSize
      )
    );
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    setGrabbing(pointers.current.size > 0);
  }

  function key(event: KeyboardEvent) {
    const center = { x: cropSize / 2, y: cropSize / 2 };
    const step = 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[event.key]) {
      const [dx, dy] = moves[event.key];
      setCrop((current) =>
        clampCrop(
          { ...current, x: current.x + dx, y: current.y + dy },
          image,
          cropSize
        )
      );
    } else if (event.key === '+' || event.key === '=') {
      setCrop((current) =>
        zoomCrop(current, current.zoom * 1.1, center, image, cropSize)
      );
    } else if (event.key === '-') {
      setCrop((current) =>
        zoomCrop(current, current.zoom / 1.1, center, image, cropSize)
      );
    } else {
      return;
    }
    event.preventDefault();
  }

  const scale = imageScale(image, cropSize, crop.zoom);
  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="avatar-cropper-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'auto',
        display: 'grid',
        placeItems: 'center',
        background: 'Canvas',
        color: 'CanvasText',
        padding: 24,
        boxSizing: 'border-box',
        zIndex: 1,
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: stageSize + 64,
          display: 'grid',
          gap: 16,
        }}
      >
        <div>
          <h2 id="avatar-cropper-title" style={{ margin: '0 0 4px' }}>
            Profile picture
          </h2>
          <p style={{ ...muted, margin: 0 }}>
            Drag to reposition. Scroll, pinch or use the slider to zoom.
          </p>
        </div>
        <div
          ref={stage}
          tabIndex={0}
          role="img"
          aria-label="Crop area. Arrow keys move the picture; plus and minus zoom."
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onKeyDown={key}
          style={{
            position: 'relative',
            justifySelf: 'center',
            width: stageSize,
            height: stageSize,
            overflow: 'hidden',
            borderRadius: 8,
            background: 'color-mix(in srgb, CanvasText 8%, Canvas)',
            touchAction: 'none',
            userSelect: 'none',
            cursor: grabbing ? 'grabbing' : 'grab',
          }}
        >
          <img
            src={source.url}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: margin + crop.x,
              top: margin + crop.y,
              width: image.width * scale,
              height: image.height * scale,
              maxWidth: 'none',
              pointerEvents: 'none',
            }}
          />
          {/* The shadow dims everything outside the avatar's shape. */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: margin,
              top: margin,
              width: cropSize,
              height: cropSize,
              borderRadius: cropSize * avatarRadiusRatio,
              boxShadow:
                '0 0 0 1px rgba(255, 255, 255, 0.75), 0 0 0 9999px rgba(0, 0, 0, 0.55)',
              pointerEvents: 'none',
            }}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={muted}>Zoom</span>
          <input
            type="range"
            min={1}
            max={maxZoom}
            step={0.01}
            value={crop.zoom}
            onChange={(event) =>
              setCrop((current) =>
                zoomCrop(
                  current,
                  Number(event.target.value),
                  { x: cropSize / 2, y: cropSize / 2 },
                  image,
                  cropSize
                )
              )
            }
            style={{ flex: 1, margin: 0 }}
          />
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          {avatarSizes.map((size) => (
            <CropPreview
              key={size.size}
              source={source}
              image={image}
              crop={crop}
              {...size}
            />
          ))}
          <p style={{ ...muted, margin: 0, fontSize: 13 }}>
            How it looks in chats and on your profile.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <button type="button" onClick={onChooseAnother}>
            Choose another…
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDone(crop, exportCrop(source.image, image, crop))}
          >
            Use photo
          </button>
        </div>
      </section>
    </div>
  );
}

function CropPreview({
  source,
  image,
  crop,
  size,
  radius,
}: {
  source: Source;
  image: Size;
  crop: Crop;
  size: number;
  radius: number;
}) {
  const ratio = size / cropSize;
  const scale = imageScale(image, cropSize, crop.zoom) * ratio;
  return (
    <div
      style={{
        position: 'relative',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      <img
        src={source.url}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: crop.x * ratio,
          top: crop.y * ratio,
          width: image.width * scale,
          height: image.height * scale,
          maxWidth: 'none',
        }}
      />
    </div>
  );
}

// The crop's coordinates of a point on screen.
function cropPoint(stage: HTMLElement, clientX: number, clientY: number) {
  const box = stage.getBoundingClientRect();
  return { x: clientX - box.left - margin, y: clientY - box.top - margin };
}

// Account creation posts the image inside a JSON body, which the server caps
// at 128 KiB; a detailed photo can pass that at the first quality.
const maxDataUrlLength = 120_000;

function exportCrop(element: HTMLImageElement, image: Size, crop: Crop) {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d')!;
  // JPEG has no alpha; transparent pixels would otherwise turn black.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, outputSize, outputSize);
  context.imageSmoothingQuality = 'high';
  const rect = sourceRect(crop, image, cropSize);
  context.drawImage(
    element,
    rect.x,
    rect.y,
    rect.size,
    rect.size,
    0,
    0,
    outputSize,
    outputSize
  );
  let dataUrl = '';
  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= maxDataUrlLength) break;
  }
  return dataUrl;
}
