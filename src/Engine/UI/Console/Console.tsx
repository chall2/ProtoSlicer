import React, { Component } from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import {LinearGenerator} from '../../Utils'

import 'bootstrap/dist/css/bootstrap.min.css';
import './Console.css';

export default this;

type LogMessage = {
    text:string;
    time:string;
};

const logList = observable([] as LogMessage[]);

@observer
export class Console extends Component {
    render() {
        const listItems = logList.map((obj) =>
            <li key={LinearGenerator()} className=" "> {obj.time + " | " + obj.text} </li>
        );

        listItems.reverse();

        return (
            <div className='start-0 bottom-0 Log'>
                <ul id="consoleList" className="list-group Li disable-scrollbars">{listItems}</ul>
            </div>
        )
    }
}

export const LogSendText = action((text ) => {
    logList.push({
        text:text,
        time:new Date().toISOString().
        replace(/T/, ' ').
        replace(/\..+/, '')
    } as LogMessage);

    if(logList.length > 10)
    {
        logList.splice(0, 1);
    }
});setInterval(()=>{
    LogSendText("123")
}, 5000)