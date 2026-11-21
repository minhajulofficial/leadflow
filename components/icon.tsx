"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { config } from "@fortawesome/fontawesome-svg-core";
import {
  faHouse, faAddressBook, faMagnifyingGlassLocation, faPlug, faCreditCard, faHeartPulse, faShieldHalved, faChartLine,
  faMoneyBillWave, faWallet, faSliders, faRightFromBracket, faPlus, faFileImport, faFileExport, faTrash, faCheck, faXmark,
  faCircleCheck, faCircleXmark, faTriangleExclamation, faCircleInfo, faEnvelope, faLock, faEye, faEyeSlash, faBolt, faFilter,
  faGlobe, faPhone, faStar, faRocket, faCrown, faSpinner, faMagnifyingGlass, faKey, faArrowRight, faUsers, faClock,
  faLocationDot, faRotate, faLink, faChevronLeft, faChevronRight, faLayerGroup, faReceipt, faWandMagicSparkles, faRotateLeft,
  faFloppyDisk, faBuilding, faPaperPlane, faQrcode, faUserShield, faFire, faHourglassHalf, faDownload, faTag, faCity, faCopy,
} from "@fortawesome/free-solid-svg-icons";
import { faGoogle, faChrome, faFacebook, faInstagram, faLinkedin } from "@fortawesome/free-brands-svg-icons";

config.autoAddCss = false; // the stylesheet is imported once in app/layout.tsx

export const ICONS = {
  home: faHouse, leads: faAddressBook, collect: faMagnifyingGlassLocation, plug: faPlug, card: faCreditCard, health: faHeartPulse,
  shield: faShieldHalved, chart: faChartLine, money: faMoneyBillWave, wallet: faWallet, sliders: faSliders, logout: faRightFromBracket,
  plus: faPlus, import: faFileImport, export: faFileExport, trash: faTrash, check: faCheck, x: faXmark, ok: faCircleCheck, no: faCircleXmark,
  warn: faTriangleExclamation, info: faCircleInfo, mail: faEnvelope, lock: faLock, eye: faEye, eyeOff: faEyeSlash, bolt: faBolt,
  filter: faFilter, globe: faGlobe, phone: faPhone, star: faStar, rocket: faRocket, crown: faCrown, spinner: faSpinner,
  search: faMagnifyingGlass, key: faKey, arrow: faArrowRight, users: faUsers, clock: faClock, pin: faLocationDot, refresh: faRotate,
  link: faLink, left: faChevronLeft, right: faChevronRight, layers: faLayerGroup, receipt: faReceipt, magic: faWandMagicSparkles,
  undo: faRotateLeft, save: faFloppyDisk, building: faBuilding, send: faPaperPlane, qr: faQrcode, admin: faUserShield, fire: faFire,
  copy: faCopy, hourglass: faHourglassHalf, download: faDownload, tag: faTag, city: faCity,
  google: faGoogle, chrome: faChrome, facebook: faFacebook, instagram: faInstagram, linkedin: faLinkedin,
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ n, className, spin, fw }: { n: IconName; className?: string; spin?: boolean; fw?: boolean }) {
  return <FontAwesomeIcon icon={ICONS[n]} className={className} spin={spin} fixedWidth={fw} />;
}
