function Icon({ size = 20, className, children }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function GridIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function CalendarIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </Icon>
  );
}

export function UsersIcon(props) {
  return (
    <Icon {...props}>
      <path d="M16 20v-1.2a3.2 3.2 0 0 0-3.2-3.2H7.2A3.2 3.2 0 0 0 4 18.8V20" />
      <circle cx="10" cy="8" r="3" />
      <path d="M20 20v-1.2a3.2 3.2 0 0 0-2.4-3.1" />
      <path d="M16 5.1a3 3 0 0 1 0 5.8" />
    </Icon>
  );
}

export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function LogoutIcon(props) {
  return (
    <Icon {...props}>
      <path d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h7A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 10 18.5V17" />
      <path d="M4 12h10M11.5 8.5 15 12l-3.5 3.5" />
    </Icon>
  );
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.25" />
      <path d="M16 16.5 20 20.5" />
    </Icon>
  );
}

export function ChevronRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

export function ChevronLeftIcon(props) {
  return (
    <Icon {...props}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  );
}

export function CheckIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="m8.5 12.2 2.3 2.3 4.7-5" />
    </Icon>
  );
}

export function AlertIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 8v4.5M12 16h.01" />
    </Icon>
  );
}

export function ArrowRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function PulseIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l2.2-5 3.2 10 2.2-5H21" />
    </Icon>
  );
}

export function UserIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.5v-.8a4.2 4.2 0 0 1 4.2-4.2h4.6a4.2 4.2 0 0 1 4.2 4.2v.8" />
    </Icon>
  );
}

export function MessageIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5h15a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4.5 3v-3H4.5A1.5 1.5 0 0 1 3 16V8a1.5 1.5 0 0 1 1.5-1.5z" />
    </Icon>
  );
}
