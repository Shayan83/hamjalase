import type {MeetingDraft} from './chat-result.ts';
import type {Meeting} from './meetings.ts';
import type {Proposal} from './conversation.ts';
import type {DirectoryUser} from '../components/participant-picker';
export type ConnectionInput={account:string;url:string;username:string;password:string};
export type Message={role:string;content:string;url?:string;confirm?:boolean;proposal?:Proposal;meetings?:Meeting[];resolved?:boolean};
export type Conversation={id:string;draft:MeetingDraft;messages:Message[];participants:DirectoryUser[];url:string;requestId:string};
export function defaultDraft():MeetingDraft{return {title:'جلسه هماهنگی تیم',date:new Date(Date.now()+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'}),time:'10:00',duration:30,agenda:'هدف: هماهنگی و تعیین قدم بعدی\n۱. مرور پیشرفت‌ها\n۲. بررسی موانع\n۳. تصمیم‌ها و تقسیم مسئولیت'}}
