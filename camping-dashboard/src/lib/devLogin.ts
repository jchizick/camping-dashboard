export function isDevelopmentLoginAvailable(
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  return nodeEnv === 'development';
}
