import test from 'node:test';
import assert from 'node:assert/strict';
import {draftValid} from '../app/lib/chat-result.ts';
const draft={title:'مرور پروژه',date:'2030-06-10',time:'10:00',duration:30,agenda:'مرور'};
test('valid meeting drafts pass while invalid durations and impossible dates fail',()=>{assert.equal(draftValid(draft),true);assert.equal(draftValid({...draft,duration:999}),false);assert.equal(draftValid({...draft,date:'2030-02-30'}),false)});
