var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var js2xml = require('js2xmlparser');
var configuration = require('./config.json');
var mkdirp = require('mkdirp');

var ElectronicInvoice = function (config) {
  if(!config) {
    config = {};
  }
  this.basePath = config.basePath || path.resolve(__dirname, configuration.basePath);
  this.destinationPath = config.destinationPath || path.resolve(__dirname, configuration.destinationPath);
};

ElectronicInvoice.prototype.generate = function (_data, callback) {
  var self = this;
  fs.readFile(self.basePath, 'utf-8', function (err, data) {
    if(err) {
      console.log(err);
    } else {

      //region setup variables
      var electronicInvoice = JSON.parse(data);
      var Header = electronicInvoice.FatturaElettronicaHeader;
      var Body = electronicInvoice.FatturaElettronicaBody;
      var HeaderDatiTrasmissione = Header.DatiTrasmissione;
      var HeaderCedentePrestatore = Header.CedentePrestatore; //FORNITORE
      var HeaderCessionarioCommittente = Header.CessionarioCommittente; //CLIENTE
      var BodyDatiGenerali = Body.DatiGenerali;
      var BodyDatiBeniServizi = Body.DatiBeniServizi;
      var BodyDatiPagamento = Body.DatiPagamento;

      var formattedDate = _data.invoice_date.split('/')[2] + '-' + _data.invoice_date.split('/')[1] + '-' + _data.invoice_date.split('/')[0];

      //endregion


      //region HEADER
      HeaderDatiTrasmissione.ProgressivoInvio = _data.invoice_number ?
        _data.invoice_number.split('/')[0] : '1';
      HeaderDatiTrasmissione.CodiceDestinatario = _data.client_office_unique_cod ? _data.client_office_unique_cod : '999999';

      HeaderDatiTrasmissione.IdTrasmittente.IdPaese = 'IT';
      HeaderDatiTrasmissione.IdTrasmittente.IdCodice = _data.from_vat;

      //region CEDENTE PRESTATORE SETTINGS
      HeaderCedentePrestatore.DatiAnagrafici.IdFiscaleIVA.IdPaese = _data.nation;
      HeaderCedentePrestatore.DatiAnagrafici.IdFiscaleIVA.IdCodice = _data.from_vat;
      HeaderCedentePrestatore.DatiAnagrafici.RegimeFiscale = 'RF01';
      HeaderCedentePrestatore.DatiAnagrafici.Anagrafica.Denominazione = _data.from_name;
      HeaderCedentePrestatore.Sede.Indirizzo = _data.from_street;
      HeaderCedentePrestatore.Sede.CAP = _data.from_post_cod;
      HeaderCedentePrestatore.Sede.Comune = _data.from_city;
      HeaderCedentePrestatore.Sede.Provincia = _data.from_province_cod;
      HeaderCedentePrestatore.Sede.Nazione = _data.nation;
      //endregion

      //region CESSIONARIO COMMITTENTE SETTINGS
      HeaderCessionarioCommittente.DatiAnagrafici.CodiceFiscale = _data.client_cod_fisc;
      HeaderCessionarioCommittente.DatiAnagrafici.Anagrafica.Denominazione = _data.client_name;
      HeaderCessionarioCommittente.Sede.Indirizzo = _data.client_street;
      HeaderCessionarioCommittente.Sede.CAP = _data.client_post_cod;
      HeaderCessionarioCommittente.Sede.Comune = _data.client_city;
      HeaderCessionarioCommittente.Sede.Provincia = _data.client_province_cod;
      HeaderCessionarioCommittente.Sede.Nazione = _data.nation;
      //endregion

      //endregion

      //region BODY

      BodyDatiGenerali.DatiGeneraliDocumento.Numero = _data.invoice_pa_progressive_number;
      BodyDatiGenerali.DatiGeneraliDocumento.Causale = 'Test';
      BodyDatiGenerali.DatiGeneraliDocumento.Data = formattedDate;
      BodyDatiGenerali.DatiGeneraliDocumento.ImportoTotaleDocumento = _data.invoice_total.value;
      var products = _data.items;
      var totalPrice = 0;
      var averageIva = 0;
      var totalAmount = 0;
      var totalTax = 0;
      var length = 0;
      var i = 0;
      for(var i = 0; i < products.length; i++) {
        var product = products[i];
        if (product) {
          BodyDatiBeniServizi.DettaglioLinee.push({
            "NumeroLinea": i + 1,
            "Descrizione": product.name,
            "Quantita": product.qty,
            "PrezzoUnitario": parseFloat(product.price).toFixed(2),
            "PrezzoTotale": parseFloat(product.total).toFixed(2),
            "AliquotaIVA": product.tax * 100,
          });
          totalPrice += product.qty * product.price;
          averageIva += product.tax * 100;
          totalAmount += product.total;
        }
      }

      averageIva = (length > 1 ? averageIva / length : averageIva).toFixed(2);
      totalPrice = (length > 1 ? totalPrice / length : totalPrice).toFixed(2);
      totalAmount = (length > 1 ? totalAmount /  length : totalAmount).toFixed(2);
      totalTax = (totalAmount - totalPrice).toFixed(2);

      BodyDatiBeniServizi.DatiRiepilogo.AliquotaIVA = averageIva;
      BodyDatiBeniServizi.DatiRiepilogo.ImponibileImporto = totalPrice;
      BodyDatiBeniServizi.DatiRiepilogo.Imposta = totalTax;
      BodyDatiBeniServizi.DatiRiepilogo.EsigibilitaIVA = _data.splitPayment ? 'S' : '-';
      BodyDatiBeniServizi.DatiRiepilogo.RiferimentoNormativo = _data.splitPayment ? 'Iva versata dal committente art. 17-ter D.P.R. 633/72' : '';
      BodyDatiPagamento.DettaglioPagamento.DataScadenzaPagamento = formattedDate;
      BodyDatiPagamento.DettaglioPagamento.ImportoPagamento = parseFloat(_data.invoice_total.value).toFixed(2);
      BodyDatiPagamento.DettaglioPagamento.IstitutoFinanziario = _data.from_bank;
      BodyDatiPagamento.DettaglioPagamento.Iban = _data.from_iban;
      //endregion


      var xmlDoc = js2xml("p:FatturaElettronica", electronicInvoice);
      fs.writeFile(self.destinationPath, xmlDoc, 'utf-8', function (err) {
        if(!err) {
          callback(null, self.destinationPath);
        }
      });
    }
  });
};


module.exports = ElectronicInvoice;
