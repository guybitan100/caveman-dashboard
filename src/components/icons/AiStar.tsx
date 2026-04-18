import {SvgIcon, SvgIconProps} from "@mui/material";
import {JSX} from "react";

export function AIStar({
  ...props
}: SvgIconProps & {bigIcon?: boolean}): JSX.Element {
  return (
    <SvgIcon {...props}>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12.9688 10.8857L16.3252 11.9229L12.9678 12.96L12 16.5498L11.0312 12.958L7.67578 11.9219L11.0312 10.8848L12.001 7.29395L12.9688 10.8857Z"
          fill="#ff5300"
        />
        <ellipse
          cx="8.97302"
          cy="14.7423"
          rx="1.29724"
          ry="1.38832"
          fill="#BDC3C8"
        />
        <ellipse
          cx="14.5955"
          cy="8.72633"
          rx="0.864829"
          ry="0.925548"
          fill="#BDC3C8"
        />
        <defs>
          <linearGradient
            id="paint0_linear_5284_89650"
            x1="19.5729"
            y1="16.4269"
            x2="4.42707"
            y2="7.5728"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#435363" />
            <stop offset="0.755208" stopColor="#435363" stopOpacity="0.01" />
            <stop offset="1" stopColor="#435363" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </SvgIcon>
  );
}
