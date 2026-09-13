import meImg from './assets/me.png';
import zaidImg from './assets/zaid.png';
import omarImg from './assets/omar.png';
import samiImg from './assets/sami.png';

const CHARACTER_PHOTOS = [meImg, zaidImg, omarImg, samiImg];
const CHARACTER_NAMES = ['You', 'Zaid', 'Omar', 'Sami'];

export function Portrait({ id }: { id: number }) {
  const photo = CHARACTER_PHOTOS[id] || meImg;
  const name = CHARACTER_NAMES[id] || 'Player';

  return (
    <div className="avatar-img-wrapper" title={name}>
      <img src={photo} alt={name} className="avatar-img" />
    </div>
  );
}

