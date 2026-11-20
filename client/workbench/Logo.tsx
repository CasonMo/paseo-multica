import { View } from "react-native";

// 参考官方八向星芒意象重新设计：圆角方块 + 断开式星芒 + 中心小核
const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export const MULTICA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><defs><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2F9169"/><stop offset="1" stop-color="#15553C"/></linearGradient></defs><rect width="24" height="24" rx="7" fill="url(#m)"/><g stroke="#FFFFFF" stroke-linecap="round" stroke-width="2.3"><path d="M12 3.4v4.2"/><path d="M12 20.6v-4.2"/><path d="M3.4 12h4.2"/><path d="M20.6 12h-4.2"/></g><g stroke="#FFFFFF" stroke-linecap="round" stroke-width="1.9" opacity="0.92"><path d="M6.9 6.9l2.4 2.4"/><path d="M17.1 6.9l-2.4 2.4"/><path d="M17.1 17.1l-2.4-2.4"/><path d="M6.9 17.1l2.4-2.4"/></g><circle cx="12" cy="12" r="1.6" fill="#CFEFDE"/></svg>`;

export function MulticaLogo({ size = 32, color = "#1F6F51" }: { size?: number; color?: string }) {
  const thickness = Math.max(1.6, size * 0.088);
  const distance = size * 0.235;
  const center = size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {RAY_ANGLES.map((angle) => {
        const long = angle % 90 === 0;
        const length = size * (long ? 0.3 : 0.22);
        const rad = (angle * Math.PI) / 180;
        const x = center + distance * Math.sin(rad);
        const y = center - distance * Math.cos(rad);
        return (
          <View
            key={angle}
            style={{
              position: "absolute",
              left: x - thickness / 2,
              top: y - length / 2,
              width: thickness,
              height: length,
              borderRadius: thickness / 2,
              backgroundColor: "#FFFFFF",
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}
      <View
        style={{
          width: size * 0.13,
          height: size * 0.13,
          borderRadius: size * 0.065,
          backgroundColor: "#E8FBF1",
        }}
      />
    </View>
  );
}
