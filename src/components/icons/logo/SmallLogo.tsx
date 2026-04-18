interface SmallLogoProps {
  height?: number;
  width?: number;
}

export const SmallLogo = ({ height = 86, width = 61 }: SmallLogoProps): JSX.Element => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 61 86"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_110_88)">
        <path
          d="M30.0488 27.1709C46.6449 27.1721 60.0926 40.3009 60.0928 56.502C60.0928 72.7038 46.6439 85.8328 30.0469 85.833C13.4496 85.833 0 72.7039 0 56.502C0.000125356 46.8742 4.59416 38.5434 10.0615 31.7031L37.0049 0L30.0488 27.1709ZM24.3584 52.9023L9.91895 58.4932L24.3584 64.083L30.0557 78.249L35.7529 64.083L50.1631 58.4932L35.7529 52.9023L30.0557 38.7637L24.3584 52.9023Z"
          fill="url(#paint0_linear_110_88)"
        />
      </g>
      <defs>
        <linearGradient
          id="paint0_linear_110_88"
          x1="8.47406e-07"
          y1="1.30052"
          x2="75.2886"
          y2="67.1615"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E75300" />
          <stop offset="1" stopColor="#F64A78" />
        </linearGradient>
        <clipPath id="clip0_110_88">
          <rect width="60.0833" height="85.8333" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};
