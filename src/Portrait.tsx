import meImg from './assets/web/portrait-me.webp';
import zaidImg from './assets/web/portrait-zaid.webp';
import omarImg from './assets/web/portrait-omar.webp';
import samiImg from './assets/web/portrait-sami.webp';

const CHARACTER_PHOTOS = [meImg, zaidImg, omarImg, samiImg];
const CHARACTER_NAMES = ['You', 'Zaid', 'Omar', 'Sami'];

// `name` is the already-translated display name; the English fallback is only
// for callers that don't have one to hand.
export function Portrait({ id, name: displayName }: { id: number; name?: string }) {
  const photo = CHARACTER_PHOTOS[id] || meImg;
  const name = displayName ?? (CHARACTER_NAMES[id] || 'Player');

  return (
    <div className="avatar-img-wrapper" title={name}>
      <img src={photo} alt={name} className="avatar-img" />
    </div>
  );
}

