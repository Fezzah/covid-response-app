import { Component, OnInit, Input } from '@angular/core';
import { HttpService } from '../../services/http.service';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { FhirOperationsService } from '../../services/fhir-operations.service'; 
import { v4 as uuidv4 } from 'uuid';
import * as FHIR from '../../interfaces/FHIR';

@Component({
  selector: 'app-admit-patient',
  templateUrl: './admit-patient.component.html',
  styleUrls: ['./admit-patient.component.css']
})
export class AdmitpatientComponent implements OnInit {
  questions: any;
  loadData: boolean;


  constructor(private httpService: HttpService, private route: ActivatedRoute, private fhirOperations: FhirOperationsService) { }
  modalStatus = false;
  ngOnInit(): void {
    this.loadForm();
  }

  loadForm() {
    this.httpService.getResourceByQueryParam('Questionnaire', '?identifier=WHO_Module_1').then(res => {
      const resource = res['entry'][0].resource;
      this.questions = resource;
      this.loadData = true;
    }).catch(error => {
      console.log(Promise.reject(error));
    });
  }

  async submitQuestionnaire(formQuestions: any) {
    console.log('formQuestions', formQuestions);

    // extract patient_demographics and save as Patient
    const patient_demographics = Object.assign({}, formQuestions.patient_demographics);
    delete formQuestions.patient_demographics;

    console.log('patient_demographics', patient_demographics);

    // create transaction bundle
    const transaction = new FHIR.Bundle();
    transaction.resourceType = 'Bundle';
    transaction.type = 'transaction';
    transaction.entry = [];

    // create patient resource
    const patientHL7 = this.fhirOperations.generatePatient(patient_demographics);
    const patient_temp_id = 'urn:uuid:' + uuidv4();
    const entry_one = new FHIR.Entry();
    entry_one.fullUrl = patient_temp_id;
    entry_one.resource = patientHL7;
    
    const req_one = new FHIR.Request();
    req_one.method = 'POST';
    req_one.url = 'Patient';

    entry_one.request = req_one;

    transaction.entry.push(entry_one);

    // create care team resource
    const ct = this.fhirOperations.generateCareTeam(patient_temp_id);
    const ct_temp_id = 'urn:uuid:' + uuidv4();
    const entry_four = new FHIR.Entry();
    entry_four.fullUrl = ct_temp_id;
    entry_four.resource = ct;

    const req_four = new FHIR.Request();
    req_four.method = 'POST';
    req_four.url = 'CareTeam';

    entry_four.request = req_four;

    transaction.entry.push(entry_four);

    // create episode of care
    const eocHL7 = this.fhirOperations.generateEpisodeOfCare(patient_temp_id, ct_temp_id);
    const eoc_temp_id = 'urn:uuid:' + uuidv4();
    const entry_two = new FHIR.Entry();
    entry_two.fullUrl = eoc_temp_id;
    entry_two.resource = eocHL7;

    const req_two = new FHIR.Request();
    req_two.method = 'POST';
    req_two.url = 'EpisodeOfCare';

    entry_two.request = req_two;

    transaction.entry.push(entry_two);
    
    const encounterHL7 = this.fhirOperations.generateEncounter(eoc_temp_id);
    const entry_five = new FHIR.Entry();
    entry_five.resource = encounterHL7;

    const req_five = new FHIR.Request();
    req_five.method = 'POST';
    req_five.url = 'Encounter';

    entry_five.request = req_five;

    transaction.entry.push(entry_five);

    // create question response resource
    const questionnaireResponse = this.fhirOperations.generateQuestionnaireResponse(formQuestions, this.questions, patient_temp_id);
    const entry_three = new FHIR.Entry();
    entry_three.resource = questionnaireResponse;

    const req_three = new FHIR.Request();
    req_three.method = 'POST';
    req_three.url = 'QuestionnaireResponse';

    entry_three.request = req_three;

    transaction.entry.push(entry_three);

    console.log('transaction', transaction);

    const transactionResponse = await this.httpService.postTransaction(transaction);
    this.modalStatus = true;
    console.log('transactionResponse', transactionResponse);
  }

}