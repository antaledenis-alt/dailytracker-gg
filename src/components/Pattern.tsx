// Фактура категории: линии, точки, сетка, диагональ, волны. Плавно исчезает к левому краю блока.
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Mask, Path, Pattern as SvgPattern, Rect, Stop } from 'react-native-svg';
import type { PatternKind } from '../theme';

let seq = 0;

export function CatPattern({ kind, color, opacity = 0.17, fade = true }: { kind: PatternKind | 'hatch'; color: string; opacity?: number; fade?: boolean }) {
  const id = React.useMemo(() => 'p' + seq++, []);
  let w = 8;
  let h = 8;
  let shape: React.ReactNode = null;
  switch (kind) {
    case 'lines':
      w = 6; h = 6;
      shape = <Path d="M0 0.5H6" stroke={color} strokeWidth={1} />;
      break;
    case 'dots':
      w = 7; h = 7;
      shape = <Circle cx={3.5} cy={3.5} r={1.15} fill={color} />;
      break;
    case 'grid':
      shape = <Path d="M0 0L8 8M8 0L0 8" stroke={color} strokeWidth={0.9} />;
      break;
    case 'diagonal':
      w = 9; h = 9;
      shape = <Path d="M-2 11L11 -2M-2 2L2 -2M7 11L11 7" stroke={color} strokeWidth={1.8} />;
      break;
    case 'waves':
      w = 12; h = 7;
      shape = <Path d="M0 4 Q3 1 6 4 T12 4" stroke={color} strokeWidth={1} fill="none" />;
      break;
    case 'hatch':
      w = 6; h = 6;
      shape = <Path d="M-1 7L7 -1" stroke={color} strokeWidth={1} />;
      break;
  }
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgPattern id={id} patternUnits="userSpaceOnUse" width={w} height={h}>
          {shape}
        </SvgPattern>
        {fade && (
          <LinearGradient id={id + 'g'} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0.35" stopColor="#fff" stopOpacity={0} />
            <Stop offset="1" stopColor="#fff" stopOpacity={1} />
          </LinearGradient>
        )}
        {fade && (
          <Mask id={id + 'm'}>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}g)`} />
          </Mask>
        )}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} mask={fade ? `url(#${id}m)` : undefined} />
    </Svg>
  );
}
