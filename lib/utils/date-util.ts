export class DateUtil {
  public static currentDateInISOUpToSeconds() {
    return new Date().toISOString().split('.')[0] + 'Z';
  }
}