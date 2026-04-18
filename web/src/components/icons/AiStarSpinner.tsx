import {SvgIcon, SvgIconProps} from "@mui/material";
import {JSX} from "react";

export function AIStarSpinner({
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
        <ellipse
          cx="12"
          cy="12"
          rx="8.77201"
          ry="8.77201"
          stroke="#435363"
          strokeOpacity="0.25"
          strokeWidth="2.27531"
        />
        <path
          d="M11.9393 3.22806C14.2657 3.21196 16.5032 4.12068 18.1597 5.75432C19.8161 7.38796 20.7557 9.6127 20.7718 11.9391"
          stroke="url(#paint0_linear_5284_89650)"
          strokeWidth="2.27531"
          strokeLinecap="round"
          strokeDasharray="0.65 0.65"
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
